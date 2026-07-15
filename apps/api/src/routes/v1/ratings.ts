import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { RatingService } from '../../services/rating.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

const UpsertRatingSchema = z.object({
  segmentDefinitionId: z.string().uuid(),
  value: z.union([z.number(), z.string()]),
  notes: z.string().max(1000).optional(),
});

export default async function ratingRoutes(app: FastifyInstance): Promise<void> {
  const ratingService = new RatingService();

  app.addHook('preHandler', requireAuth);

  // GET /projects/:projectId/sprints/:sprintId/ratings — all current ratings for a sprint
  app.get('/:projectId/sprints/:sprintId/ratings', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId, sprintId } = request.params as { projectId: string; sprintId: string };
    return ratingService.getSprintRatings(request.context.organizationId, projectId, sprintId);
  });

  // POST /projects/:projectId/sprints/:sprintId/contributors/:contributorId/ratings
  // Creates or supersedes the current rating for this contributor + segment combination.
  // Only PROJECT_ADMIN (or ORG_ADMIN) can submit ratings — PROJECT_VIEWER is read-only.
  app.post('/:projectId/sprints/:sprintId/contributors/:contributorId/ratings', {
    schema: { body: zodToJsonSchema(UpsertRatingSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, sprintId, contributorId } = request.params as {
      projectId: string;
      sprintId: string;
      contributorId: string;
    };
    const input = UpsertRatingSchema.parse(request.body);
    await ratingService.upsertRating(
      request.context.organizationId,
      projectId,
      sprintId,
      contributorId,
      input,
      request.context.userId
    );
    return reply.code(204).send();
  });

  // DELETE /projects/:projectId/sprints/:sprintId/contributors/:contributorId/ratings/:segmentId
  app.delete('/:projectId/sprints/:sprintId/contributors/:contributorId/ratings/:segmentId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, sprintId, contributorId, segmentId } = request.params as {
      projectId: string;
      sprintId: string;
      contributorId: string;
      segmentId: string;
    };
    await ratingService.deleteRating(
      request.context.organizationId,
      projectId,
      sprintId,
      contributorId,
      segmentId
    );
    return reply.code(204).send();
  });
}
