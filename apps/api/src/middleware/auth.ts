import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AccessTokenPayload } from '../types/index.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.accessVerify<AccessTokenPayload>();
    const payload = request.user as AccessTokenPayload;
    request.context = {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      orgRole: payload.orgRole,
    };
  } catch {
    reply.code(401).send({
      type: 'https://pulseboard.dev/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'A valid access token is required.',
    });
  }
}
