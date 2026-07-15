import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

// @fastify/jwt namespace decorators don't self-augment types when using custom
// jwtSign/jwtVerify option names — declare them explicitly so TypeScript resolves them.
// Per @fastify/jwt: the sign side decorates `reply`, the verify side decorates `request`.
declare module 'fastify' {
  interface FastifyReply {
    accessSign(payload: object, options?: object): Promise<string>;
    refreshSign(payload: object, options?: object): Promise<string>;
  }
  interface FastifyRequest {
    accessVerify<T = object>(options?: object): Promise<T>;
    refreshVerify<T = object>(options?: object): Promise<T>;
  }
}

export default fp(async function jwtPlugin(app: FastifyInstance) {
  // Access token — verified from Authorization: Bearer header
  app.register(fastifyJwt, {
    secret: process.env.JWT_ACCESS_SECRET!,
    namespace: 'access',
    jwtVerify: 'accessVerify',
    jwtSign: 'accessSign',
  });

  // Refresh token — verified from httpOnly cookie pb_refresh
  app.register(fastifyJwt, {
    secret: process.env.JWT_REFRESH_SECRET!,
    namespace: 'refresh',
    jwtVerify: 'refreshVerify',
    jwtSign: 'refreshSign',
    cookie: {
      cookieName: 'pb_refresh',
      signed: false,
    },
  });
});
