import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SyncService } from '../../services/sync.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

const TriggerSyncSchema = z.object({
  // since is optional — omitting it triggers a full re-sync from the beginning
  since: z.string().datetime().optional(),
});

export default async function syncRoutes(app: FastifyInstance): Promise<void> {
  const syncService = new SyncService();

  app.addHook('preHandler', requireAuth);

  // GET /projects/:projectId/sync — list the last 20 sync jobs for a project
  app.get('/:projectId/sync', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return syncService.listSyncJobs(request.context.organizationId, projectId);
  });

  // GET /projects/:projectId/sync/:syncJobId — single job detail
  app.get('/:projectId/sync/:syncJobId', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request, reply) => {
    const { syncJobId } = request.params as { projectId: string; syncJobId: string };
    const job = await syncService.getSyncJob(request.context.organizationId, syncJobId);
    if (!job) return reply.code(404).send(notFound('Sync job not found'));
    return job;
  });

  // POST /projects/:projectId/sync — trigger a manual sync; PROJECT_ADMIN only
  app.post('/:projectId/sync', {
    schema: { body: zodToJsonSchema(TriggerSyncSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { since } = TriggerSyncSchema.parse(request.body ?? {});
    const result = await syncService.triggerManualSync(
      request.context.organizationId,
      projectId,
      request.context.userId,
      since ? new Date(since) : undefined
    );
    return reply.code(202).send(result);
  });
}

function notFound(detail: string) {
  return { type: 'https://pulseboard.dev/errors/not-found', title: 'Not Found', status: 404, detail };
}
