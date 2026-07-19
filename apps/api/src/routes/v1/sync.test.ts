import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

// Regression test for a real bug found by live testing: listSyncJobs/getSyncJob selected
// raw snake_case columns (started_at, completed_at, records_processed, error_message,
// triggered_by, created_at), but the frontend Sync History table (IntegrationsPage.tsx)
// reads job.startedAt/completedAt/errorMessage/recordsProcessed/triggeredBy — all of which
// were silently undefined. Only status/type/id happened to render correctly because those
// keys are identical in both cases, which is exactly why this went unnoticed.
describe('GET /projects/:projectId/sync — field naming', () => {
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

  it('returns camelCase fields the frontend actually reads', async () => {
    const ownerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Sync Owner',
      email: 'sync-owner@example.com',
      password: 'password123',
      organizationName: 'Sync Org',
      organizationSlug: 'sync-org',
    });
    const { accessToken, organizationId } = ownerRes.body;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Sync Project', slug: 'sync-project' });
    const projectId = projectRes.body.id as string;

    const jobId = uuidv4();
    await db('sync_jobs').insert({
      id: jobId,
      organization_id: organizationId,
      project_id: projectId,
      type: 'GITHUB_SYNC',
      status: 'FAILED',
      triggered_by: 'MANUAL',
      started_at: new Date('2026-07-19T10:00:00Z'),
      completed_at: new Date('2026-07-19T10:00:05Z'),
      records_processed: null,
      error_message: 'GitHub 401: Bad credentials',
    });

    const listRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/sync`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);
    const job = listRes.body.find((j: { id: string }) => j.id === jobId);
    expect(job).toBeDefined();
    expect(job.triggeredBy).toBe('MANUAL');
    expect(job.startedAt).toBeTruthy();
    expect(job.completedAt).toBeTruthy();
    expect(job.errorMessage).toBe('GitHub 401: Bad credentials');
    // These keys must NOT be present — proves the fix, not just the presence of extra data
    expect(job.started_at).toBeUndefined();
    expect(job.error_message).toBeUndefined();

    const detailRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/sync/${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.errorMessage).toBe('GitHub 401: Bad credentials');
    expect(detailRes.body.startedAt).toBeTruthy();
  });
});
