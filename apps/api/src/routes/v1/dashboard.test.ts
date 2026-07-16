import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

// Regression test for a real bug: `.sum(db.raw('CASE ... END as alias'))` produces invalid
// SQL ("syntax error at or near 'as'") because the alias lands inside the SUM(...) argument
// instead of on the aggregate itself. This was undetected because the equivalent code path
// in metrics.worker.ts never ran (only fires when an active sprint exists) — this endpoint
// is sprint-independent, so it's the first thing that ever actually executed the query.
describe('GET /projects/:projectId/overview', () => {
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

  it('aggregates issue stats per contributor across all issues, independent of sprints', async () => {
    const registerRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Overview Owner',
      email: 'overview-owner@example.com',
      password: 'password123',
      organizationName: 'Overview Org',
      organizationSlug: 'overview-org',
    });
    const { accessToken, organizationId } = registerRes.body;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Overview Project', slug: 'overview-project' });
    const projectId = projectRes.body.id as string;

    const contributorRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/contributors`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Test Contributor', jiraAccountId: 'jira-account-1' });
    const contributorId = contributorRes.body.id as string;

    // No sync worker involved — insert issue snapshots directly, with sprint_id left null,
    // to prove the aggregation works without any sprint ever existing.
    await db('issue_snapshots').insert([
      {
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        sprint_id: null,
        assignee_contributor_id: contributorId,
        external_key: 'PROJ-1',
        summary: 'Done issue',
        status: 'Done',
        issue_type: 'Task',
        priority: 'High',
        labels: [],
        synced_at: db.fn.now(),
      },
      {
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        sprint_id: null,
        assignee_contributor_id: contributorId,
        external_key: 'PROJ-2',
        summary: 'In progress issue',
        status: 'In Progress',
        issue_type: 'Task',
        priority: 'Medium',
        labels: [],
        synced_at: db.fn.now(),
      },
    ]);

    const overviewRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/overview`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body).toHaveLength(1);
    const [stats] = overviewRes.body;
    expect(stats.contributorId).toBe(contributorId);
    expect(stats.issuesTotal).toBe(2);
    expect(stats.issuesDone).toBe(1);
    expect(stats.issuesHighPriority).toBe(1);
    expect(stats.issuesInProgress).toBe(1);
  });
});
