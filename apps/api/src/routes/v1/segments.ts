import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SegmentService } from '../../services/segment.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

const CreateSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  scaleType: z.enum(['NUMERIC', 'ENUM']),
  scaleMax: z.number().int().min(2).max(10).optional(),
  enumValues: z.array(z.string().min(1)).min(2).max(10).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const UpdateSegmentSchema = CreateSegmentSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

const FromTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

export default async function segmentRoutes(app: FastifyInstance): Promise<void> {
  const segmentService = new SegmentService();

  app.addHook('preHandler', requireAuth);

  // GET /projects/:projectId/segments
  app.get('/:projectId/segments', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    const { includeArchived } = request.query as { includeArchived?: string };
    return segmentService.listSegments(
      request.context.organizationId,
      projectId,
      includeArchived === 'true'
    );
  });

  // POST /projects/:projectId/segments
  app.post('/:projectId/segments', {
    schema: { body: zodToJsonSchema(CreateSegmentSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = CreateSegmentSchema.parse(request.body);
    const segment = await segmentService.createSegment(
      request.context.organizationId,
      projectId,
      input,
      request.context.userId
    );
    return reply.code(201).send(segment);
  });

  // POST /projects/:projectId/segments/from-template — copy a platform template into this project
  app.post('/:projectId/segments/from-template', {
    schema: { body: zodToJsonSchema(FromTemplateSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { templateId } = FromTemplateSchema.parse(request.body);
    const segment = await segmentService.createFromTemplate(
      request.context.organizationId,
      projectId,
      templateId,
      request.context.userId
    );
    return reply.code(201).send(segment);
  });

  // PATCH /projects/:projectId/segments/:segmentId
  app.patch('/:projectId/segments/:segmentId', {
    schema: { body: zodToJsonSchema(UpdateSegmentSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, segmentId } = request.params as { projectId: string; segmentId: string };
    const input = UpdateSegmentSchema.parse(request.body);
    const updated = await segmentService.updateSegment(
      request.context.organizationId,
      projectId,
      segmentId,
      input
    );
    if (!updated) return reply.code(404).send(notFound('Segment not found'));
    return updated;
  });

  // DELETE /projects/:projectId/segments/:segmentId
  app.delete('/:projectId/segments/:segmentId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, segmentId } = request.params as { projectId: string; segmentId: string };
    await segmentService.deleteSegment(
      request.context.organizationId,
      projectId,
      segmentId
    );
    return reply.code(204).send();
  });
}

function notFound(detail: string) {
  return { type: 'https://pulseboard.dev/errors/not-found', title: 'Not Found', status: 404, detail };
}
