import type { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { OrgService } from '../../services/org.service.js';
import { requireAuth } from '../../middleware/auth.js';
import { UpdateOrgSchema, InviteMemberSchema, AcceptInviteSchema } from '@pulseboard/shared';

export default async function orgRoutes(app: FastifyInstance): Promise<void> {
  const orgService = new OrgService();

  // All org routes require a valid access token
  app.addHook('preHandler', requireAuth);

  // GET /orgs/me — returns the org the caller belongs to
  app.get('/me', async (request, reply) => {
    const org = await orgService.getOrg(request.context.organizationId);
    if (!org) return reply.code(404).send(notFound('Organisation not found'));
    return org;
  });

  // PATCH /orgs/me — org name update; only ORG_ADMIN
  app.patch('/me', {
    schema: { body: zodToJsonSchema(UpdateOrgSchema) },
  }, async (request, reply) => {
    if (request.context.orgRole !== 'ORG_ADMIN') {
      return reply.code(403).send(forbidden('Only Org Admins can update organisation details'));
    }
    const { name } = UpdateOrgSchema.parse(request.body);
    if (!name) return reply.code(400).send(badRequest('name is required'));
    const updated = await orgService.updateOrg(
      request.context.organizationId,
      name,
      request.context.userId
    );
    if (!updated) return reply.code(404).send(notFound('Organisation not found'));
    return updated;
  });

  // GET /orgs/me/members
  app.get('/me/members', async (request) => {
    return orgService.listMembers(request.context.organizationId);
  });

  // DELETE /orgs/me/members/:userId — remove a member; only ORG_ADMIN
  app.delete('/me/members/:userId', async (request, reply) => {
    if (request.context.orgRole !== 'ORG_ADMIN') {
      return reply.code(403).send(forbidden('Only Org Admins can remove members'));
    }
    const { userId } = request.params as { userId: string };
    await orgService.removeMember(
      request.context.organizationId,
      userId,
      request.context.userId
    );
    return reply.code(204).send();
  });

  // POST /orgs/me/invites — send an email invite; only ORG_ADMIN
  app.post('/me/invites', {
    schema: { body: zodToJsonSchema(InviteMemberSchema) },
  }, async (request, reply) => {
    if (request.context.orgRole !== 'ORG_ADMIN') {
      return reply.code(403).send(forbidden('Only Org Admins can invite members'));
    }
    const input = InviteMemberSchema.parse(request.body);
    const result = await orgService.inviteMember(
      request.context.organizationId,
      input,
      request.context.userId
    );
    // In production the token is emailed, not returned in the response.
    // Returning it here so the API is testable without an SMTP server.
    return reply.code(201).send(result);
  });

  // POST /orgs/invites/accept — called by the invited user after clicking the email link
  app.post('/invites/accept', {
    schema: { body: zodToJsonSchema(AcceptInviteSchema) },
  }, async (request) => {
    const { token } = AcceptInviteSchema.parse(request.body);
    const result = await orgService.acceptInvite(token, request.context.userId);
    return result;
  });
}

function notFound(detail: string) {
  return { type: 'https://pulseboard.dev/errors/not-found', title: 'Not Found', status: 404, detail };
}

function forbidden(detail: string) {
  return { type: 'https://pulseboard.dev/errors/forbidden', title: 'Forbidden', status: 403, detail };
}

function badRequest(detail: string) {
  return { type: 'https://pulseboard.dev/errors/bad-request', title: 'Bad Request', status: 400, detail };
}
