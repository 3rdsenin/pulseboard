import Fastify, { type FastifyError } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import jwtPlugin from './plugins/jwt.js';
import { formatSchemaErrors } from './utils/schema-error-formatter.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/v1/auth.js';
import orgRoutes from './routes/v1/orgs.js';
import projectRoutes from './routes/v1/projects.js';
import integrationRoutes from './routes/v1/integrations.js';
import contributorRoutes from './routes/v1/contributors.js';
import syncRoutes from './routes/v1/sync.js';
import dashboardRoutes from './routes/v1/dashboard.js';
import ratingRoutes from './routes/v1/ratings.js';
import segmentRoutes from './routes/v1/segments.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    // ratings' value field is number | string (NUMERIC or ENUM segment scale) — Ajv's
    // strict mode rejects JSON Schema "type" arrays unless this is explicitly allowed.
    ajv: {
      customOptions: {
        allowUnionTypes: true,
      },
    },
  });

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  app.decorate('redis', redis);

  // Both must be registered before any route plugins — Fastify resolves each route's
  // error/schema handling from its own encapsulated context at register() time, so
  // anything set after routes are registered never applies to them.
  app.setSchemaErrorFormatter(formatSchemaErrors);

  app.setErrorHandler<FastifyError>(async (error, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
    }
    return reply.code(status).send({
      type: 'https://pulseboard.dev/errors/internal',
      title: status === 500 ? 'Internal Server Error' : error.message,
      status,
      detail: status === 500 ? 'An unexpected error occurred' : error.message,
      requestId: request.id,
    });
  });

  await app.register(fastifyCookie);

  await app.register(fastifyCors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  await app.register(jwtPlugin);

  // Auth routes use a narrower cookie path so the refresh token cookie is only sent
  // to /api/v1/auth/* — it won't be attached to other API calls
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(orgRoutes, { prefix: '/api/v1/orgs' });

  // Project-scoped routes share the /api/v1/projects prefix; integrations and
  // contributors are nested under /:projectId for the path to be self-documenting
  await app.register(projectRoutes, { prefix: '/api/v1/projects' });
  await app.register(integrationRoutes, { prefix: '/api/v1/projects' });
  await app.register(contributorRoutes, { prefix: '/api/v1/projects' });
  await app.register(syncRoutes, { prefix: '/api/v1/projects' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/projects' });
  await app.register(ratingRoutes, { prefix: '/api/v1/projects' });
  await app.register(segmentRoutes, { prefix: '/api/v1/projects' });

  // Platform-level segment templates — auth required, no project scope
  app.get('/api/v1/segment-templates', {
    preHandler: [requireAuth],
  }, async () => {
    const { SegmentService } = await import('./services/segment.service.js');
    return new SegmentService().listTemplates();
  });

  app.get('/health', async () => ({ ok: true }));

  app.addHook('onClose', async () => {
    redis.disconnect();
  });

  return app;
}
