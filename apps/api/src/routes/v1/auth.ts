import type { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AuthService } from '../../services/auth.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { RegisterSchema, LoginSchema } from '@pulseboard/shared';
import type { RefreshTokenPayload } from '../../types/index.js';

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY ?? '7d';

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app.redis);

  app.post('/register', {
    schema: { body: zodToJsonSchema(RegisterSchema) },
  }, async (request, reply) => {
    const input = RegisterSchema.parse(request.body);
    const { userId, orgId } = await authService.register(input);

    const userData = await authService.getUserForToken(userId);
    if (!userData) {
      return reply.code(500).send({ type: 'about:blank', title: 'Internal Server Error', status: 500, detail: 'Failed to load new user' });
    }

    const jti = await authService.createRefreshJti(userId);

    const accessToken = await reply.accessSign({
      sub: userId,
      email: userData.email,
      organizationId: orgId,
      orgRole: userData.orgRole,
    }, { expiresIn: ACCESS_EXPIRY });

    const refreshToken = await reply.refreshSign(
      { sub: userId, jti },
      { expiresIn: REFRESH_EXPIRY }
    );

    reply
      .setCookie('pb_refresh', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/v1/auth',
        maxAge: REFRESH_TTL_SECONDS,
      })
      .code(201)
      .send({ accessToken, userId, organizationId: orgId });
  });

  app.post('/login', {
    schema: { body: zodToJsonSchema(LoginSchema) },
  }, async (request, reply) => {
    const input = LoginSchema.parse(request.body);
    const userData = await authService.login(input);
    const jti = await authService.createRefreshJti(userData.userId);

    const accessToken = await reply.accessSign({
      sub: userData.userId,
      email: userData.email,
      organizationId: userData.organizationId,
      orgRole: userData.orgRole,
    }, { expiresIn: ACCESS_EXPIRY });

    const refreshToken = await reply.refreshSign(
      { sub: userData.userId, jti },
      { expiresIn: REFRESH_EXPIRY }
    );

    reply
      .setCookie('pb_refresh', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/v1/auth',
        maxAge: REFRESH_TTL_SECONDS,
      })
      .send({ accessToken, userId: userData.userId, organizationId: userData.organizationId });
  });

  app.post('/refresh', async (request, reply) => {
    let payload: RefreshTokenPayload;
    try {
      payload = await request.refreshVerify<RefreshTokenPayload>({ onlyCookie: true });
    } catch {
      return reply.code(401).send({
        type: 'https://pulseboard.dev/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired refresh token.',
      });
    }

    const valid = await authService.validateRefreshJti(payload.sub, payload.jti);
    if (!valid) {
      return reply.code(401).send({
        type: 'https://pulseboard.dev/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Refresh token has been revoked.',
      });
    }

    const userData = await authService.getUserForToken(payload.sub);
    if (!userData) {
      return reply.code(401).send({
        type: 'https://pulseboard.dev/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'User not found.',
      });
    }

    const newJti = await authService.rotateRefreshJti(payload.sub, payload.jti);

    const accessToken = await reply.accessSign({
      sub: userData.userId,
      email: userData.email,
      organizationId: userData.organizationId,
      orgRole: userData.orgRole,
    }, { expiresIn: ACCESS_EXPIRY });

    const refreshToken = await reply.refreshSign(
      { sub: userData.userId, jti: newJti },
      { expiresIn: REFRESH_EXPIRY }
    );

    reply
      .setCookie('pb_refresh', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/v1/auth',
        maxAge: REFRESH_TTL_SECONDS,
      })
      .send({ accessToken });
  });

  app.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const payload = await request.refreshVerify<RefreshTokenPayload>({ onlyCookie: true });
      await authService.revokeRefreshJti(payload.sub, payload.jti);
    } catch {
      // Revoke best-effort; always clear the cookie
    }
    reply
      .clearCookie('pb_refresh', { path: '/api/v1/auth' })
      .send({ ok: true });
  });
}

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
