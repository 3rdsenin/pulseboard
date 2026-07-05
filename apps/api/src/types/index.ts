import type { FastifyRequest } from 'fastify';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  organizationId: string;
  orgRole: 'ORG_ADMIN' | 'ORG_MEMBER';
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface RequestContext {
  userId: string;
  email: string;
  organizationId: string;
  orgRole: 'ORG_ADMIN' | 'ORG_MEMBER';
}

// Augment Fastify's Request type so request.context is typed everywhere
declare module 'fastify' {
  interface FastifyRequest {
    context: RequestContext;
  }
}
