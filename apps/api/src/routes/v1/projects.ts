import type { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ProjectService } from '../../services/project.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/project-role.js';
import { CreateProjectSchema, UpdateProjectSchema, AddProjectMemberSchema } from '@pulseboard/shared';

export default async function projectRoutes(app: FastifyInstance): Promise<void> {
  const projectService = new ProjectService();

  app.addHook('preHandler', requireAuth);

  // GET /projects
  app.get('/', async (request) => {
    return projectService.listProjects(
      request.context.organizationId,
      request.context.userId,
      request.context.orgRole
    );
  });

  // POST /projects — any org member can create a project; they become PROJECT_ADMIN automatically
  app.post('/', {
    schema: { body: zodToJsonSchema(CreateProjectSchema) },
  }, async (request, reply) => {
    const input = CreateProjectSchema.parse(request.body);
    const project = await projectService.createProject(
      request.context.organizationId,
      input,
      request.context.userId
    );
    return reply.code(201).send(project);
  });

  // GET /projects/:projectId
  app.get('/:projectId', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await projectService.getProject(request.context.organizationId, projectId);
    if (!project) return reply.code(404).send(notFound('Project not found'));
    return project;
  });

  // PATCH /projects/:projectId
  app.patch('/:projectId', {
    schema: { body: zodToJsonSchema(UpdateProjectSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = UpdateProjectSchema.parse(request.body);
    const updated = await projectService.updateProject(
      request.context.organizationId,
      projectId,
      input
    );
    if (!updated) return reply.code(404).send(notFound('Project not found'));
    return updated;
  });

  // DELETE /projects/:projectId — soft delete; only PROJECT_ADMIN
  app.delete('/:projectId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    await projectService.deleteProject(request.context.organizationId, projectId);
    return reply.code(204).send();
  });

  // GET /projects/:projectId/members
  app.get('/:projectId/members', {
    preHandler: [requireProjectRole('PROJECT_VIEWER')],
  }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return projectService.listMembers(request.context.organizationId, projectId);
  });

  // POST /projects/:projectId/members
  app.post('/:projectId/members', {
    schema: { body: zodToJsonSchema(AddProjectMemberSchema) },
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { userId, role } = AddProjectMemberSchema.parse(request.body);
    await projectService.addMember(
      request.context.organizationId,
      projectId,
      userId,
      role,
      request.context.userId
    );
    return reply.code(204).send();
  });

  // PATCH /projects/:projectId/members/:userId — change role
  app.patch('/:projectId/members/:userId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, userId } = request.params as { projectId: string; userId: string };
    const { role } = request.body as { role: 'PROJECT_ADMIN' | 'PROJECT_VIEWER' };
    if (!role) return reply.code(400).send(badRequest('role is required'));
    await projectService.updateMemberRole(projectId, userId, role);
    return reply.code(204).send();
  });

  // DELETE /projects/:projectId/members/:userId
  app.delete('/:projectId/members/:userId', {
    preHandler: [requireProjectRole('PROJECT_ADMIN')],
  }, async (request, reply) => {
    const { projectId, userId } = request.params as { projectId: string; userId: string };
    await projectService.removeMember(projectId, userId, request.context.userId);
    return reply.code(204).send();
  });
}

function notFound(detail: string) {
  return { type: 'https://pulseboard.dev/errors/not-found', title: 'Not Found', status: 404, detail };
}

function badRequest(detail: string) {
  return { type: 'https://pulseboard.dev/errors/bad-request', title: 'Bad Request', status: 400, detail };
}
