import type { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CreateIntegrationSchema, UpdateIntegrationSchema, TestConnectionSchema } from '@pulseboard/shared';
import { IntegrationService } from '../../services/integration.service.js';
import { JiraAdapter } from '../../adapters/jira.adapter.js';
import { GitHubAdapter } from '../../adapters/github.adapter.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

const adapters = {
  JIRA: new JiraAdapter(),
  GITHUB: new GitHubAdapter(),
};

export default async function integrationRoutes(app: FastifyInstance): Promise<void> {
  const integrationService = new IntegrationService();

  app.addHook('preHandler', requireAuth);

  // Validates credentials against the real provider API before anything is saved —
  // the IntegrationAdapter interface (PB-ADR-005) always had testConnection(), but no
  // route ever called it.
  app.post('/:projectId/integrations/test-connection', {
    schema: { body: zodToJsonSchema(TestConnectionSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request) => {
    const input = TestConnectionSchema.parse(request.body);
    const adapter = adapters[input.type];
    return adapter.testConnection({ type: input.type, ...input.config }, input.credentials);
  });

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
