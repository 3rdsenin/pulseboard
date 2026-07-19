import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FeatureCategoryService } from '../../services/feature-category.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  matchPatterns: z.array(z.string().min(1)).min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const UpdateCategorySchema = CreateCategorySchema.partial();

const ReorderCategoriesSchema = z.object({
  order: z.array(z.string().uuid()),
});

export default async function featureCategoryRoutes(app: FastifyInstance): Promise<void> {
  const service = new FeatureCategoryService();

  app.addHook('preHandler', requireAuth);

  // GET /projects/:projectId/feature-categories
  app.get('/:projectId/feature-categories', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return service.listCategories(request.context.organizationId, projectId);
  });

  // POST /projects/:projectId/feature-categories
  app.post('/:projectId/feature-categories', {
    schema: { body: zodToJsonSchema(CreateCategorySchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = CreateCategorySchema.parse(request.body);
    const category = await service.createCategory(
      request.context.organizationId,
      projectId,
      input,
      request.context.userId
    );
    return reply.code(201).send(category);
  });

  // PATCH /projects/:projectId/feature-categories/:categoryId
  app.patch('/:projectId/feature-categories/:categoryId', {
    schema: { body: zodToJsonSchema(UpdateCategorySchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, categoryId } = request.params as { projectId: string; categoryId: string };
    const input = UpdateCategorySchema.parse(request.body);
    const updated = await service.updateCategory(
      request.context.organizationId,
      projectId,
      categoryId,
      input
    );
    if (!updated) return reply.code(404).send(notFound('Feature category not found'));
    return updated;
  });

  // DELETE /projects/:projectId/feature-categories/:categoryId
  app.delete('/:projectId/feature-categories/:categoryId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, categoryId } = request.params as { projectId: string; categoryId: string };
    await service.deleteCategory(request.context.organizationId, projectId, categoryId);
    return reply.code(204).send();
  });

  // POST /projects/:projectId/feature-categories/reorder
  app.post('/:projectId/feature-categories/reorder', {
    schema: { body: zodToJsonSchema(ReorderCategoriesSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { order } = ReorderCategoriesSchema.parse(request.body);
    await service.reorderCategories(request.context.organizationId, projectId, order);
    return reply.code(204).send();
  });
}

function notFound(detail: string) {
  return {
    type: 'https://pulseboard.dev/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail,
  };
}
