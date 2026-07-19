import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

describe('shareable dashboard links', () => {
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
      name: 'Share Owner',
      email: 'share-owner@example.com',
      password: 'password123',
      organizationName: 'Share Org',
      organizationSlug: 'share-org',
    });
    const ownerToken = ownerRes.body.accessToken as string;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Share Project', slug: 'share-project' });
    const projectId = projectRes.body.id as string;

    return { ownerToken, projectId };
  }

  it('gates a private link behind auth, then opens it up when flipped to public', async () => {
    const { ownerToken, projectId } = await setup();

    const createRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/share`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: false });
    expect(createRes.status).toBe(201);
    const { shareToken } = createRes.body;

    const anonRes = await request(app.server).get(`/api/v1/share/${shareToken}`);
    expect(anonRes.status).toBe(401);

    const authedRes = await request(app.server)
      .get(`/api/v1/share/${shareToken}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(authedRes.status).toBe(200);
    expect(authedRes.body.isPublic).toBe(false);

    const flipRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/share`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: true });
    expect(flipRes.status).toBe(201);
    expect(flipRes.body.shareToken).toBe(shareToken);

    const anonAfterPublicRes = await request(app.server).get(`/api/v1/share/${shareToken}`);
    expect(anonAfterPublicRes.status).toBe(200);
    expect(anonAfterPublicRes.body.isPublic).toBe(true);
  });

  it('returns 404 for an unknown share token', async () => {
    const res = await request(app.server).get('/api/v1/share/pb_share_does_not_exist');
    expect(res.status).toBe(404);
  });

  it('rejects a cross-org user managing another org\'s share link', async () => {
    const { projectId } = await setup();

    const otherOrgRes = await request(app.server).post('/api/v1/auth/register').send({
      name: 'Other Owner',
      email: 'share-other-owner@example.com',
      password: 'password123',
      organizationName: 'Other Share Org',
      organizationSlug: 'other-share-org',
    });

    const res = await request(app.server)
      .post(`/api/v1/projects/${projectId}/share`)
      .set('Authorization', `Bearer ${otherOrgRes.body.accessToken}`)
      .send({ isPublic: true });

    expect(res.status).toBe(404);
  });
});
