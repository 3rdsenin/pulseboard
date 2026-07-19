import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

// Regression test for a real bug found by live testing: project_members (and
// organization_members) has a UNIQUE(project_id, user_id) constraint with no deleted_at
// exclusion. Removing a member soft-deletes their row, but re-adding them later did a plain
// INSERT, which threw an uncaught unique-violation 500 instead of reviving the row. This is
// an entirely ordinary workflow (remove someone, add them back later) that was completely
// broken before the fix in ProjectService.addMember/OrgService.acceptInvite.
describe('project member add/remove/re-add', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  beforeEach(async () => {
    await db('organizations').del();
    await db('users').del();
  });

  async function setup() {
    const ownerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Owner',
      email: 'members-owner@example.com',
      password: 'password123',
      organizationName: 'Members Org',
      organizationSlug: 'members-org',
    });
    const ownerToken = ownerRes.body.accessToken as string;

    const memberRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Future Member',
      email: 'members-second@example.com',
      password: 'password123',
      organizationName: 'Second Own Org',
      organizationSlug: 'members-second-own-org',
    });
    const memberUserId = memberRes.body.userId as string;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Members Project', slug: 'members-project' });
    const projectId = projectRes.body.id as string;

    // The second user must be an org member before they can be added to a project
    const inviteRes = await request(app.server)
      .post('/api/v1/orgs/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'members-second@example.com', role: 'ORG_MEMBER' });
    await request(app.server)
      .post('/api/v1/orgs/invites/accept')
      .set('Authorization', `Bearer ${memberRes.body.accessToken}`)
      .send({ token: inviteRes.body.token });

    return { ownerToken, projectId, memberUserId };
  }

  it('allows re-adding a project member after they were removed', async () => {
    const { ownerToken, projectId, memberUserId } = await setup();

    const addRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberUserId, role: 'PROJECT_VIEWER' });
    expect(addRes.status).toBe(204);

    const removeRes = await request(app.server)
      .delete(`/api/v1/projects/${projectId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(removeRes.status).toBe(204);

    // Re-adding used to throw an uncaught 500 (unique constraint on the soft-deleted row)
    const readdRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberUserId, role: 'PROJECT_ADMIN' });
    expect(readdRes.status).toBe(204);

    const listRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const revived = listRes.body.find((m: { userId: string }) => m.userId === memberUserId);
    expect(revived).toBeDefined();
    expect(revived.role).toBe('PROJECT_ADMIN');
  });

  it('rejects re-adding an already-active project member with a conflict', async () => {
    const { ownerToken, projectId, memberUserId } = await setup();

    await request(app.server)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberUserId, role: 'PROJECT_VIEWER' });

    const dupRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberUserId, role: 'PROJECT_VIEWER' });

    expect(dupRes.status).toBe(409);
  });
});
