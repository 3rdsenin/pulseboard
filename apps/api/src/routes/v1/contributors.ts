import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ContributorService } from '../../services/contributor.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

const CreateContributorSchema = z.object({
  displayName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  jiraAccountId: z.string().optional(),
  githubUsername: z.string().optional(),
  roleLabel: z.string().max(100).optional(),
});

const UpdateContributorSchema = CreateContributorSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const AddAliasSchema = z.object({
  alias: z.string().min(1).max(255),
});

export default async function contributorRoutes(app: FastifyInstance): Promise<void> {
  const contributorService = new ContributorService();

  app.addHook('preHandler', requireAuth);

  // GET /projects/:projectId/contributors?includeInactive=true
  app.get('/:projectId/contributors', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    const { includeInactive } = request.query as { includeInactive?: string };
    return contributorService.listContributors(
      request.context.organizationId,
      projectId,
      includeInactive === 'true'
    );
  });

  app.get('/:projectId/contributors/:contributorId', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request, reply) => {
    const { projectId, contributorId } = request.params as { projectId: string; contributorId: string };
    const contributor = await contributorService.getContributor(
      request.context.organizationId,
      projectId,
      contributorId
    );
    if (!contributor) return reply.code(404).send(notFound('Contributor not found'));
    return contributor;
  });

  app.post('/:projectId/contributors', {
    schema: { body: zodToJsonSchema(CreateContributorSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = CreateContributorSchema.parse(request.body);
    const contributor = await contributorService.createContributor(
      request.context.organizationId,
      projectId,
      input,
      request.context.userId
    );
    return reply.code(201).send(contributor);
  });

  app.patch('/:projectId/contributors/:contributorId', {
    schema: { body: zodToJsonSchema(UpdateContributorSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, contributorId } = request.params as { projectId: string; contributorId: string };
    const input = UpdateContributorSchema.parse(request.body);
    const updated = await contributorService.updateContributor(
      request.context.organizationId,
      projectId,
      contributorId,
      input
    );
    if (!updated) return reply.code(404).send(notFound('Contributor not found'));
    return updated;
  });

  app.delete('/:projectId/contributors/:contributorId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, contributorId } = request.params as { projectId: string; contributorId: string };
    await contributorService.deleteContributor(
      request.context.organizationId,
      projectId,
      contributorId
    );
    return reply.code(204).send();
  });

  // Alias sub-resource — aliases let the sync engine match Jira/GitHub identities
  // to a single canonical contributor when usernames differ across systems
  app.post('/:projectId/contributors/:contributorId/aliases', {
    schema: { body: zodToJsonSchema(AddAliasSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { contributorId } = request.params as { projectId: string; contributorId: string };
    const { alias } = AddAliasSchema.parse(request.body);
    const row = await contributorService.addAlias(contributorId, alias, request.context.userId);
    return reply.code(201).send(row);
  });

  app.delete('/:projectId/contributors/:contributorId/aliases/:aliasId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { contributorId, aliasId } = request.params as {
      projectId: string;
      contributorId: string;
      aliasId: string;
    };
    await contributorService.removeAlias(contributorId, aliasId);
    return reply.code(204).send();
  });
}

function notFound(detail: string) {
  return { type: 'https://pulseboard.dev/errors/not-found', title: 'Not Found', status: 404, detail };
}
