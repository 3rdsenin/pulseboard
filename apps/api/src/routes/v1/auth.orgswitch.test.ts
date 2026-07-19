import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

// Regression test for a real bug found by live testing: login() always resolves a user's
// JWT to their oldest organisation membership, but register() always forces every new user
// to create their own brand-new org at signup. That meant a user invited into a second org
// could NEVER obtain a token scoped to it — their own org from registration is always older
// — so the invite/accept flow "worked" (created a membership row) but was practically
// unusable. listOrganizations()/switch-org fix this by letting the caller pick which
// membership's token they want.
describe('org switching', () => {
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

  it('lets an invited existing user obtain a token scoped to the org they were invited into', async () => {
    // Org A: the inviter
    const ownerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Org A Owner',
      email: 'orga-owner@example.com',
      password: 'password123',
      organizationName: 'Org A',
      organizationSlug: 'org-a-switch',
    });
    const ownerToken = ownerRes.body.accessToken as string;
    const orgAId = ownerRes.body.organizationId as string;

    // Invitee: registers their own org first (as every real user does)
    const inviteRes = await request(app.server)
      .post('/api/v1/orgs/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'invitee@example.com', role: 'ORG_MEMBER' });
    expect(inviteRes.status).toBe(201);
    const { token: inviteToken } = inviteRes.body;

    const inviteeRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Invitee',
      email: 'invitee@example.com',
      password: 'password123',
      organizationName: 'Invitee Own Org',
      organizationSlug: 'invitee-own-org-switch',
    });
    const inviteeToken = inviteeRes.body.accessToken as string;
    const inviteeOwnOrgId = inviteeRes.body.organizationId as string;

    // Accept the invite — this creates a real membership in Org A
    const acceptRes = await request(app.server)
      .post('/api/v1/orgs/invites/accept')
      .set('Authorization', `Bearer ${inviteeToken}`)
      .send({ token: inviteToken });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.organizationId).toBe(orgAId);

    // Without switching, the invitee's own token still points at their own (older) org
    const meBeforeSwitch = await request(app.server)
      .get('/api/v1/orgs/me')
      .set('Authorization', `Bearer ${inviteeToken}`);
    expect(meBeforeSwitch.body.id).toBe(inviteeOwnOrgId);

    // listOrganizations shows both memberships
    const orgsRes = await request(app.server)
      .get('/api/v1/auth/organizations')
      .set('Authorization', `Bearer ${inviteeToken}`);
    expect(orgsRes.status).toBe(200);
    const orgIds = orgsRes.body.map((o: { organizationId: string }) => o.organizationId);
    expect(orgIds).toEqual(expect.arrayContaining([inviteeOwnOrgId, orgAId]));

    // Switching to Org A reissues a token scoped to it
    const switchRes = await request(app.server)
      .post('/api/v1/auth/switch-org')
      .set('Authorization', `Bearer ${inviteeToken}`)
      .send({ organizationId: orgAId });
    expect(switchRes.status).toBe(200);
    expect(switchRes.body.organizationId).toBe(orgAId);
    expect(switchRes.body.orgRole).toBe('ORG_MEMBER');
    const switchedToken = switchRes.body.accessToken as string;

    // The new token actually works against Org A resources
    const meAfterSwitch = await request(app.server)
      .get('/api/v1/orgs/me')
      .set('Authorization', `Bearer ${switchedToken}`);
    expect(meAfterSwitch.body.id).toBe(orgAId);
  });

  it('rejects switching to an org the caller is not a member of', async () => {
    const userRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Solo User',
      email: 'solo-switch@example.com',
      password: 'password123',
      organizationName: 'Solo Org',
      organizationSlug: 'solo-org-switch',
    });
    const otherOrgRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Other Owner',
      email: 'other-owner-switch@example.com',
      password: 'password123',
      organizationName: 'Other Org',
      organizationSlug: 'other-org-switch',
    });

    const res = await request(app.server)
      .post('/api/v1/auth/switch-org')
      .set('Authorization', `Bearer ${userRes.body.accessToken}`)
      .send({ organizationId: otherOrgRes.body.organizationId });

    expect(res.status).toBe(403);
  });
});
