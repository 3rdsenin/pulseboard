import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';
import { DashboardService } from '../../services/dashboard.service.js';
import { RatingService } from '../../services/rating.service.js';
import db from '../../db/index.js';

interface ShareInput {
  isPublic: boolean;
}

export default async function shareRoutes(app: FastifyInstance): Promise<void> {
  const dashboardService = new DashboardService();
  const ratingService = new RatingService();

  // Helper middleware to resolve share token project context
  async function resolveShareToken(request: FastifyRequest, reply: FastifyReply) {
    const { shareToken } = request.params as { shareToken: string };
    if (!shareToken) {
      return reply.code(400).send({ message: 'Share token is required' });
    }

    const project = await db('projects')
      .whereRaw("settings->>'shareToken' = ?", [shareToken])
      .whereNull('deleted_at')
      .first();

    if (!project) {
      return reply.code(404).send({ message: 'Invalid share token' });
    }

    const settings = project.settings || {};
    const isPublic = settings.isPublic === true;

    if (!isPublic) {
      try {
        await requireAuth(request, reply);
      } catch {
        return reply.code(401).send({ message: 'Authentication required' });
      }

      if (request.context.organizationId !== project.organization_id) {
        return reply.code(403).send({ message: 'Forbidden' });
      }
    }

    // Attach resolved project context to request params so handlers can access them
    request.projectContext = {
      organizationId: project.organization_id,
      projectId: project.id,
      name: project.name,
      isPublic,
    };
  }

  // 1. Generate/Update share link
  // POST /projects/:projectId/share
  app.post('/projects/:projectId/share', {
    preHandler: [requireAuth, requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { isPublic } = request.body as ShareInput;

    const project = await db('projects')
      .where({ id: projectId, organization_id: request.context.organizationId })
      .first();
    if (!project) {
      return reply.code(404).send({ message: 'Project not found' });
    }

    const settings = project.settings || {};
    let shareToken = settings.shareToken;

    if (!shareToken) {
      const tokenSuffix = crypto.randomBytes(16).toString('hex');
      shareToken = `pb_share_${tokenSuffix}`;
    }

    const updatedSettings = {
      ...settings,
      shareToken,
      isPublic: !!isPublic,
    };

    await db('projects')
      .where({ id: projectId })
      .update({ settings: updatedSettings, updated_at: db.fn.now() });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    return reply.code(201).send({
      shareToken,
      url: `${appUrl}/s/${shareToken}`,
      isPublic: !!isPublic,
    });
  });

  // 2. Resolve share token metadata
  // GET /share/:shareToken
  app.get('/share/:shareToken', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    return {
      projectId: ctx.projectId,
      projectName: ctx.name,
      isPublic: ctx.isPublic,
    };
  });

  // GET /share/:shareToken/contributors
  app.get('/share/:shareToken/contributors', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    return db('contributors')
      .where({
        organization_id: ctx.organizationId,
        project_id: ctx.projectId,
        deleted_at: null,
      })
      .orderBy('display_name', 'asc');
  });

  // 3. GET /share/:shareToken/sprints
  app.get('/share/:shareToken/sprints', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    return dashboardService.listSprints(ctx.organizationId, ctx.projectId);
  });

  // 4. GET /share/:shareToken/overview
  app.get('/share/:shareToken/overview', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    return dashboardService.getProjectOverview(ctx.organizationId, ctx.projectId);
  });

  // 5. GET /share/:shareToken/sprints/:sprintId/metrics
  app.get('/share/:shareToken/sprints/:sprintId/metrics', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    const { sprintId } = request.params as { sprintId: string };
    return dashboardService.getSprintMetrics(ctx.organizationId, ctx.projectId, sprintId);
  });

  // 6. GET /share/:shareToken/sprints/:sprintId/ratings
  app.get('/share/:shareToken/sprints/:sprintId/ratings', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    const { sprintId } = request.params as { sprintId: string };
    return ratingService.getSprintRatings(ctx.organizationId, ctx.projectId, sprintId);
  });

  // 7. GET /share/:shareToken/features/breakdown
  app.get('/share/:shareToken/features/breakdown', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    const { sprintId } = request.query as { sprintId?: string };
    return dashboardService.getFeatureBreakdown(ctx.organizationId, ctx.projectId, sprintId);
  });

  // 8. GET /share/:shareToken/issues
  app.get('/share/:shareToken/issues', {
    preHandler: [resolveShareToken],
  }, async (request) => {
    const ctx = request.projectContext!;
    const { status, type, priority, assigneeId, sprintId, q, page, perPage } = request.query as {
      status?: string;
      type?: string;
      priority?: string;
      assigneeId?: string;
      sprintId?: string;
      q?: string;
      page?: string;
      perPage?: string;
    };

    return dashboardService.getProjectIssues(
      ctx.organizationId,
      ctx.projectId,
      {
        status,
        type,
        priority,
        assigneeId,
        sprintId,
        q,
        page: page ? parseInt(page, 10) : undefined,
        perPage: perPage ? parseInt(perPage, 10) : undefined,
      }
    );
  });
}
