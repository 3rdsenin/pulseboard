import type { FastifyInstance } from 'fastify';
import { DashboardService } from '../../services/dashboard.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';

export default async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const dashboardService = new DashboardService();

  app.addHook('preHandler', requireAuth);

  // GET /projects/:projectId/overview — contributor stats across ALL synced issues,
  // independent of sprints. Always available, even for projects with zero sprints
  // (e.g. a Kanban board with no sprint concept at all).
  app.get('/:projectId/overview', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return dashboardService.getProjectOverview(request.context.organizationId, projectId);
  });

  // GET /projects/:projectId/sprints — ordered newest first; used to populate sprint tabs
  app.get('/:projectId/sprints', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return dashboardService.listSprints(request.context.organizationId, projectId);
  });

  // GET /projects/:projectId/sprints/:sprintId/metrics — contributor cards for one sprint
  app.get('/:projectId/sprints/:sprintId/metrics', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId, sprintId } = request.params as { projectId: string; sprintId: string };
    return dashboardService.getSprintMetrics(
      request.context.organizationId,
      projectId,
      sprintId
    );
  });

  // GET /projects/:projectId/sprints/:sprintId/contributors/:contributorId/issues
  // Drill-down: issue list for a single contributor in a sprint
  app.get('/:projectId/sprints/:sprintId/contributors/:contributorId/issues', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId, sprintId, contributorId } = request.params as {
      projectId: string;
      sprintId: string;
      contributorId: string;
    };
    return dashboardService.getContributorIssues(
      request.context.organizationId,
      projectId,
      contributorId,
      sprintId
    );
  });
}
