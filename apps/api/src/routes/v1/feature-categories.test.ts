import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

describe('feature categories and breakdown', () => {
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
      name: 'Category Owner',
      email: 'category-owner@example.com',
      password: 'password123',
      organizationName: 'Category Org',
      organizationSlug: 'category-org',
    });
    const ownerToken = ownerRes.body.accessToken as string;
    const organizationId = ownerRes.body.organizationId as string;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Category Project', slug: 'category-project' });
    const projectId = projectRes.body.id as string;

    return { ownerToken, organizationId, projectId };
  }

  it('creates, reorders, and archives categories', async () => {
    const { ownerToken, projectId } = await setup();

    const cat1 = await request(app.server)
      .post(`/api/v1/projects/${projectId}/feature-categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Seating', matchPatterns: ['seating'], color: '#22c55e' });
    expect(cat1.status).toBe(201);
    expect(cat1.body.matchPatterns).toEqual(['seating']);

    const cat2 = await request(app.server)
      .post(`/api/v1/projects/${projectId}/feature-categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Attendance', matchPatterns: ['attendance'] });
    expect(cat2.status).toBe(201);

    const reorderRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/feature-categories/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ order: [cat2.body.id, cat1.body.id] });
    expect(reorderRes.status).toBe(204);

    const listRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/feature-categories`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.body[0].id).toBe(cat2.body.id);
    expect(listRes.body[0].displayOrder).toBe(1);

    const deleteRes = await request(app.server)
      .delete(`/api/v1/projects/${projectId}/feature-categories/${cat1.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/feature-categories`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(afterDeleteRes.body.map((c: { id: string }) => c.id)).not.toContain(cat1.body.id);
  });

  // The breakdown reads issue_snapshots.feature_category_id, which is only populated by
  // metrics.worker.ts matching each category's matchPatterns against an issue's external_key
  // prefix or labels — categories don't filter issues at query time. This test writes
  // feature_category_id directly to isolate the breakdown math from the matching worker.
  it('computes completion rate from matched issues', async () => {
    const { ownerToken, organizationId, projectId } = await setup();

    const catRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/feature-categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Seating', matchPatterns: ['seating'] });
    const categoryId = catRes.body.id as string;

    await db('issue_snapshots').insert([
      {
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        feature_category_id: categoryId,
        external_key: 'PROJ-1',
        summary: 'Seating chart',
        status: 'Done',
        issue_type: 'Story',
        labels: [],
        synced_at: db.fn.now(),
      },
      {
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        feature_category_id: categoryId,
        external_key: 'PROJ-2',
        summary: 'Seating layout bug',
        status: 'In Progress',
        issue_type: 'Bug',
        labels: [],
        synced_at: db.fn.now(),
      },
    ]);

    const breakdownRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/features/breakdown`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(breakdownRes.status).toBe(200);
    const seating = breakdownRes.body.find((c: { id: string }) => c.id === categoryId);
    expect(seating.total).toBe(2);
    expect(seating.done).toBe(1);
    expect(seating.completionRate).toBe(0.5);
  });
});
