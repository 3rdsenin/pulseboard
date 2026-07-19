import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

describe('contributor management', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let projectId: string;

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

    const ownerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Contrib Owner',
      email: 'contrib-owner@example.com',
      password: 'password123',
      organizationName: 'Contrib Org',
      organizationSlug: 'contrib-org',
    });
    ownerToken = ownerRes.body.accessToken;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Contrib Project', slug: 'contrib-project' });
    projectId = projectRes.body.id;
  });

  it('creates, edits, adds an alias to, and deactivates a contributor', async () => {
    const createRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/contributors`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayName: 'Jane Doe', githubUsername: 'janedoe', roleLabel: 'Backend Engineer' });
    expect(createRes.status).toBe(201);
    const contributorId = createRes.body.id as string;

    const editRes = await request(app.server)
      .patch(`/api/v1/projects/${projectId}/contributors/${contributorId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ jiraAccountId: 'jira-acct-1', roleLabel: 'Senior Backend Engineer' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.jira_account_id).toBe('jira-acct-1');

    const aliasRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/contributors/${contributorId}/aliases`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ alias: 'J. Doe' });
    expect(aliasRes.status).toBe(201);

    const deactivateRes = await request(app.server)
      .patch(`/api/v1/projects/${projectId}/contributors/${contributorId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.is_active).toBe(false);

    const activeListRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/contributors`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(activeListRes.body.map((c: { id: string }) => c.id)).not.toContain(contributorId);

    const allListRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/contributors?includeInactive=true`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(allListRes.body.map((c: { id: string }) => c.id)).toContain(contributorId);
  });
});
