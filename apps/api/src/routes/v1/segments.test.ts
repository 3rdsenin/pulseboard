import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

describe('segment definitions', () => {
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
      name: 'Segments Owner',
      email: 'segments-owner@example.com',
      password: 'password123',
      organizationName: 'Segments Org',
      organizationSlug: 'segments-org',
    });
    ownerToken = ownerRes.body.accessToken;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Segments Project', slug: 'segments-project' });
    projectId = projectRes.body.id;
  });

  it('creates a numeric segment and an enum segment', async () => {
    const numericRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/segments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Delivery', scaleType: 'NUMERIC', scaleMax: 5, displayOrder: 1 });
    expect(numericRes.status).toBe(201);
    expect(numericRes.body.scaleType).toBe('NUMERIC');

    const enumRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/segments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'AI Adoption',
        scaleType: 'ENUM',
        enumValues: ['Yes', 'No', 'Unable to assess'],
        displayOrder: 2,
      });
    expect(enumRes.status).toBe(201);
    expect(enumRes.body.enumValues).toEqual(['Yes', 'No', 'Unable to assess']);
  });

  // Regression test: createFromTemplate used to call JSON.parse() on enum_values, a jsonb
  // column `pg` already parses into a JS array — throwing a 500 on any ENUM-scale template.
  it('imports an ENUM-scale template (AI Adoption) without throwing', async () => {
    const templatesRes = await request(app.server)
      .get('/api/v1/segment-templates')
      .set('Authorization', `Bearer ${ownerToken}`);
    const aiAdoptionTemplate = templatesRes.body.find((t: { name: string }) => t.name === 'AI Adoption');
    expect(aiAdoptionTemplate).toBeDefined();

    const fromTemplateRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/segments/from-template`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ templateId: aiAdoptionTemplate.id });
    expect(fromTemplateRes.status).toBe(201);
    expect(fromTemplateRes.body.enumValues).toEqual(['Yes', 'No', 'Unable to assess']);
  });

  it('imports the platform baseline templates and matches the AOMS reference names', async () => {
    // Regression guard: the seed data previously used placeholder names ("Communication",
    // "Code Quality", "Sprint Reliability") that didn't match the AOMS reference script
    // (generate_full_report.py) CLAUDE.md names as the ground truth for segment definitions.
    const templatesRes = await request(app.server)
      .get('/api/v1/segment-templates')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(templatesRes.status).toBe(200);
    const names = templatesRes.body.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['Delivery', 'Collaboration', 'Ownership & Accountability', 'Growth', 'AI Adoption'])
    );

    const deliveryTemplate = templatesRes.body.find((t: { name: string }) => t.name === 'Delivery');
    const fromTemplateRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/segments/from-template`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ templateId: deliveryTemplate.id });
    expect(fromTemplateRes.status).toBe(201);
    expect(fromTemplateRes.body.name).toBe('Delivery');
  });

  it('reorders and archives segments, and excludes archived by default', async () => {
    const seg1 = await request(app.server)
      .post(`/api/v1/projects/${projectId}/segments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Segment One', scaleType: 'NUMERIC', scaleMax: 5, displayOrder: 1 });
    const seg2 = await request(app.server)
      .post(`/api/v1/projects/${projectId}/segments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Segment Two', scaleType: 'NUMERIC', scaleMax: 5, displayOrder: 2 });

    const reorderRes = await request(app.server)
      .patch(`/api/v1/projects/${projectId}/segments/${seg2.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayOrder: 1 });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.displayOrder).toBe(1);

    const archiveRes = await request(app.server)
      .patch(`/api/v1/projects/${projectId}/segments/${seg1.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isArchived: true });
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.isArchived).toBe(true);

    const activeRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/segments`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(activeRes.body.map((s: { id: string }) => s.id)).not.toContain(seg1.body.id);

    const allRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/segments?includeArchived=true`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(allRes.body.map((s: { id: string }) => s.id)).toContain(seg1.body.id);
  });
});
