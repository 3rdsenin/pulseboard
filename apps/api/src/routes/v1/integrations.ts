import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { IntegrationService } from '../../services/integration.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

const CreateIntegrationSchema = z.object({
  type: z.enum(['JIRA', 'GITHUB', 'GITLAB', 'LINEAR']),
  config: z.record(z.unknown()),
  // credentials are validated here but encrypted before storage — never logged or returned
  credentials: z.record(z.string()),
});

const UpdateIntegrationSchema = z.object({
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.string()).optional(),
});

export default async function integrationRoutes(app: FastifyInstance): Promise<void> {
  const integrationService = new IntegrationService();

  app.addHook('preHandler', requireAuth);

  // All integration routes are scoped to a project; PROJECT_VIEWER can read, PROJECT_ADMIN can write
  app.get('/:projectId/integrations', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return integrationService.listIntegrations(request.context.organizationId, projectId);
  });

  app.get('/:projectId/integrations/:integrationId', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request, reply) => {
    const { projectId, integrationId } = request.params as { projectId: string; integrationId: string };
    const integration = await integrationService.getIntegration(
      request.context.organizationId,
      projectId,
      integrationId
    );
    if (!integration) return reply.code(404).send(notFound('Integration not found'));
    return integration;
  });

  app.post('/:projectId/integrations', {
    schema: { body: zodToJsonSchema(CreateIntegrationSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = CreateIntegrationSchema.parse(request.body);
    const integration = await integrationService.createIntegration(
      request.context.organizationId,
      projectId,
      input,
      request.context.userId
    );
    return reply.code(201).send(integration);
  });

  app.patch('/:projectId/integrations/:integrationId', {
    schema: { body: zodToJsonSchema(UpdateIntegrationSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, integrationId } = request.params as { projectId: string; integrationId: string };
    const input = UpdateIntegrationSchema.parse(request.body);
    const updated = await integrationService.updateIntegration(
      request.context.organizationId,
      projectId,
      integrationId,
      input
    );
    if (!updated) return reply.code(404).send(notFound('Integration not found'));
    return updated;
  });

  app.delete('/:projectId/integrations/:integrationId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, integrationId } = request.params as { projectId: string; integrationId: string };
    await integrationService.deleteIntegration(
      request.context.organizationId,
      projectId,
      integrationId
    );
    return reply.code(204).send();
  });
}

function notFound(detail: string) {
  return { type: 'https://pulseboard.dev/errors/not-found', title: 'Not Found', status: 404, detail };
}
