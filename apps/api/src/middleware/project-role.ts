import type { FastifyRequest, FastifyReply } from 'fastify';
import db from '../db/index.js';

export function requireProjectRole(minimumRole: 'PROJECT_VIEWER' | 'PROJECT_ADMIN') {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, userId } = request.context;
    const { projectId } = request.params as { projectId: string };

    if (!projectId) {
      reply.code(400).send({
        type: 'https://pulseboard.dev/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'projectId is required.',
      });
      return;
    }

    const project = await db('projects')
      .where({ id: projectId, organization_id: organizationId, deleted_at: null })
      .first('id');

    if (!project) {
      reply.code(404).send({
        type: 'https://pulseboard.dev/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Project not found.',
      });
      return;
    }

    // ORG_ADMIN has implicit PROJECT_ADMIN on every project in their org —
    // they must be able to manage projects they were never explicitly added to.
    if (request.context.orgRole === 'ORG_ADMIN') {
      return;
    }

    const membership = await db('project_members')
      .where({ project_id: projectId, user_id: userId, deleted_at: null })
      .first('role');

    const roleOrder: Record<string, number> = {
      PROJECT_VIEWER: 1,
      PROJECT_ADMIN: 2,
    };

    if (!membership || roleOrder[membership.role] < roleOrder[minimumRole]) {
      reply.code(403).send({
        type: 'https://pulseboard.dev/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'You do not have the required role for this project.',
      });
    }
  };
}
