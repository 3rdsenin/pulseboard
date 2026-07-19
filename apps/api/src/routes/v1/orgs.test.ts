import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

describe('org invites and membership', () => {
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

  async function inviteAndAccept(ownerToken: string, email: string, name: string, slug: string) {
    const inviteRes = await request(app.server)
      .post('/api/v1/orgs/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email, role: 'ORG_MEMBER' });
    expect(inviteRes.status).toBe(201);

    const registerRes = await request(app.server).post('/api/v1/auth/register').send({
      name,
      email,
      password: 'password123',
      organizationName: `${name} Own Org`,
      organizationSlug: slug,
    });

    const acceptRes = await request(app.server)
      .post('/api/v1/orgs/invites/accept')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .send({ token: inviteRes.body.token });
    expect(acceptRes.status).toBe(200);

    return registerRes.body.userId as string;
  }

  it('accepts an invite and assigns the invited role', async () => {
    const ownerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Invite Owner',
      email: 'invite-owner@example.com',
      password: 'password123',
      organizationName: 'Invite Org',
      organizationSlug: 'invite-org',
    });
    const ownerToken = ownerRes.body.accessToken as string;

    const memberUserId = await inviteAndAccept(ownerToken, 'member-a@example.com', 'Member A', 'member-a-own-org');

    const membersRes = await request(app.server)
      .get('/api/v1/orgs/me/members')
      .set('Authorization', `Bearer ${ownerToken}`);

    const member = membersRes.body.find((m: { userId: string }) => m.userId === memberUserId);
    expect(member).toBeDefined();
    expect(member.role).toBe('ORG_MEMBER');
  });

  // Regression test: organization_members has UNIQUE(organization_id, user_id) with no
  // deleted_at exclusion — re-inviting a removed member used to throw an uncaught 500.
  it('allows re-inviting a member after they were removed from the org', async () => {
    const ownerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Reinvite Owner',
      email: 'reinvite-owner@example.com',
      password: 'password123',
      organizationName: 'Reinvite Org',
      organizationSlug: 'reinvite-org',
    });
    const ownerToken = ownerRes.body.accessToken as string;

    const memberUserId = await inviteAndAccept(ownerToken, 'member-b@example.com', 'Member B', 'member-b-own-org');

    const removeRes = await request(app.server)
      .delete(`/api/v1/orgs/me/members/${memberUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(removeRes.status).toBe(204);

    // Re-invite the same (already-registered) email
    const reinviteRes = await request(app.server)
      .post('/api/v1/orgs/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member-b@example.com', role: 'ORG_ADMIN' });
    expect(reinviteRes.status).toBe(201);

    const memberLoginRes = await request(app.server).post('/api/v1/auth/login').send({
      email: 'member-b@example.com',
      password: 'password123',
    });

    const reacceptRes = await request(app.server)
      .post('/api/v1/orgs/invites/accept')
      .set('Authorization', `Bearer ${memberLoginRes.body.accessToken}`)
      .send({ token: reinviteRes.body.token });
    expect(reacceptRes.status).toBe(200);

    const membersRes = await request(app.server)
      .get('/api/v1/orgs/me/members')
      .set('Authorization', `Bearer ${ownerToken}`);
    const revived = membersRes.body.find((m: { userId: string }) => m.userId === memberUserId);
    expect(revived).toBeDefined();
    expect(revived.role).toBe('ORG_ADMIN');
  });

  it('rejects inviting an email that is already an active member', async () => {
    const ownerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Dup Owner',
      email: 'dup-owner@example.com',
      password: 'password123',
      organizationName: 'Dup Org',
      organizationSlug: 'dup-org',
    });
    const ownerToken = ownerRes.body.accessToken as string;
    await inviteAndAccept(ownerToken, 'member-c@example.com', 'Member C', 'member-c-own-org');

    const dupInviteRes = await request(app.server)
      .post('/api/v1/orgs/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member-c@example.com', role: 'ORG_MEMBER' });

    expect(dupInviteRes.status).toBe(409);
  });
});
