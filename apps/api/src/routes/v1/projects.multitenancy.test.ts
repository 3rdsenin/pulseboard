import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

// Verifies the cross-org isolation requirement from 06_quality_standards.md:
// "User in Org A attempts to read Project B (Org B) via URL manipulation —
// must return 404 (not 403, to avoid leaking existence)."
describe('multi-tenancy isolation — projects', () => {
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
    // organizations/users cascade-delete project_members, projects, org_members, etc.
    await db('organizations').del();
    await db('users').del();
  });

  async function registerOrgWithProject(label: string) {
    const registerRes = await request(app.server)
      .post('/api/v1/auth/register')
      .send({
        name: `${label} Owner`,
        email: `${label.toLowerCase()}-owner@example.com`,
        password: 'password123',
        organizationName: `${label} Org`,
        organizationSlug: `${label.toLowerCase()}-org`,
      });
    expect(registerRes.status).toBe(201);
    const { accessToken, organizationId } = registerRes.body;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `${label} Project`, slug: `${label.toLowerCase()}-project` });
    expect(projectRes.status).toBe(201);

    return { accessToken, organizationId, projectId: projectRes.body.id as string };
  }

  it('returns 404 (not 403) when a user requests a project belonging to a different org', async () => {
    const orgA = await registerOrgWithProject('Alpha');
    const orgB = await registerOrgWithProject('Bravo');

    const crossOrgRes = await request(app.server)
      .get(`/api/v1/projects/${orgB.projectId}`)
      .set('Authorization', `Bearer ${orgA.accessToken}`);

    expect(crossOrgRes.status).toBe(404);
  });

  it('allows a user to read their own org project (control case)', async () => {
    const orgA = await registerOrgWithProject('Charlie');

    const ownProjectRes = await request(app.server)
      .get(`/api/v1/projects/${orgA.projectId}`)
      .set('Authorization', `Bearer ${orgA.accessToken}`);

    expect(ownProjectRes.status).toBe(200);
    expect(ownProjectRes.body.id).toBe(orgA.projectId);
  });

  it('returns 404 for a cross-org project on the members sub-resource too', async () => {
    const orgA = await registerOrgWithProject('Delta');
    const orgB = await registerOrgWithProject('Echo');

    const membersRes = await request(app.server)
      .get(`/api/v1/projects/${orgB.projectId}/members`)
      .set('Authorization', `Bearer ${orgA.accessToken}`);

    expect(membersRes.status).toBe(404);
  });
});
