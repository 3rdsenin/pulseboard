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

// Attached by share.ts's resolveShareToken preHandler once a share token has been
// resolved to a project (and, for private links, an authorised org member).
export interface ShareProjectContext {
  organizationId: string;
  projectId: string;
  name: string;
  isPublic: boolean;
}

// Augment Fastify's Request type so request.context is typed everywhere
declare module 'fastify' {
  interface FastifyRequest {
    context: RequestContext;
    projectContext?: ShareProjectContext;
  }
}
