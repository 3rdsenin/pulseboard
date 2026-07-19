import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

describe('sprint ratings', () => {
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
      name: 'Ratings Owner',
      email: 'ratings-owner@example.com',
      password: 'password123',
      organizationName: 'Ratings Org',
      organizationSlug: 'ratings-org',
    });
    const ownerToken = ownerRes.body.accessToken as string;
    const organizationId = ownerRes.body.organizationId as string;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Ratings Project', slug: 'ratings-project' });
    const projectId = projectRes.body.id as string;

    const contributorRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/contributors`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayName: 'Rated Contributor' });
    const contributorId = contributorRes.body.id as string;

    const segmentRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/segments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Delivery', scaleType: 'NUMERIC', scaleMax: 5 });
    const segmentId = segmentRes.body.id as string;

    const sprintId = uuidv4();
    await db('sprints').insert({
      id: sprintId,
      organization_id: organizationId,
      project_id: projectId,
      external_id: 'sprint-1',
      name: 'Sprint 1',
      state: 'ACTIVE',
      synced_at: db.fn.now(),
    });

    // A second, non-admin user in the same org to test RAT-005 access control
    const viewerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Viewer',
      email: 'ratings-viewer@example.com',
      password: 'password123',
      organizationName: 'Viewer Own Org',
      organizationSlug: 'ratings-viewer-own-org',
    });
    const inviteRes = await request(app.server)
      .post('/api/v1/orgs/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'ratings-viewer@example.com', role: 'ORG_MEMBER' });
    await request(app.server)
      .post('/api/v1/orgs/invites/accept')
      .set('Authorization', `Bearer ${viewerRes.body.accessToken}`)
      .send({ token: inviteRes.body.token });
    const switchRes = await request(app.server)
      .post('/api/v1/auth/switch-org')
      .set('Authorization', `Bearer ${viewerRes.body.accessToken}`)
      .send({ organizationId });
    const viewerToken = switchRes.body.accessToken as string;
    await request(app.server)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: viewerRes.body.userId, role: 'PROJECT_VIEWER' });

    return { ownerToken, viewerToken, projectId, contributorId, segmentId, sprintId };
  }

  it('saves a rating and versions it on edit, retaining prior versions', async () => {
    const { ownerToken, projectId, contributorId, segmentId, sprintId } = await setup();

    const saveRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/sprints/${sprintId}/contributors/${contributorId}/ratings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ segmentDefinitionId: segmentId, value: 4, notes: 'first' });
    expect(saveRes.status).toBe(204);

    const editRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/sprints/${sprintId}/contributors/${contributorId}/ratings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ segmentDefinitionId: segmentId, value: 5, notes: 'revised' });
    expect(editRes.status).toBe(204);

    const listRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/sprints/${sprintId}/ratings`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].value).toBe(5);
    expect(listRes.body[0].version).toBe(2);

    const versions = await db('contributor_ratings').where({ contributor_id: contributorId }).orderBy('version');
    expect(versions).toHaveLength(2);
    expect(versions[0].value).toBe(4);
    expect(versions[1].value).toBe(5);
  });

  it('allows a PROJECT_VIEWER to read ratings but not submit them (RAT-005)', async () => {
    const { viewerToken, projectId, contributorId, segmentId, sprintId } = await setup();

    const readRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/sprints/${sprintId}/ratings`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(readRes.status).toBe(200);

    const writeRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/sprints/${sprintId}/contributors/${contributorId}/ratings`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ segmentDefinitionId: segmentId, value: 3 });
    expect(writeRes.status).toBe(403);
  });
});
