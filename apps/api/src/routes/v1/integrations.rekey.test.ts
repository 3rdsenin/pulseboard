import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import db from '../../db/index.js';

describe('integration credential rotation (INT-005)', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let projectId: string;
  let integrationId: string;

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
      name: 'Rekey Owner',
      email: 'rekey-owner@example.com',
      password: 'password123',
      organizationName: 'Rekey Org',
      organizationSlug: 'rekey-org',
    });
    ownerToken = ownerRes.body.accessToken;

    const projectRes = await request(app.server)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Rekey Project', slug: 'rekey-project' });
    projectId = projectRes.body.id;

    const createRes = await request(app.server)
      .post(`/api/v1/projects/${projectId}/integrations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'GITHUB',
        config: { repos: ['octocat/Hello-World'] },
        credentials: { personalAccessToken: 'ghp_original_token' },
      });
    expect(createRes.status).toBe(201);
    integrationId = createRes.body.id;
  });

  it('rotates credentials without ever exposing them, and re-encrypts on each rotation', async () => {
    const before = await db('integrations').where({ id: integrationId }).first('credentials_encrypted');

    const rotateRes = await request(app.server)
      .patch(`/api/v1/projects/${projectId}/integrations/${integrationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ credentials: { personalAccessToken: 'ghp_rotated_token' } });

    expect(rotateRes.status).toBe(200);
    expect(JSON.stringify(rotateRes.body)).not.toContain('ghp_rotated_token');
    expect(rotateRes.body.credentials_encrypted).toBeUndefined();
    expect(rotateRes.body.credentials).toBeUndefined();

    const after = await db('integrations').where({ id: integrationId }).first('credentials_encrypted');
    expect(after.credentials_encrypted).not.toBe(before.credentials_encrypted);

    const getRes = await request(app.server)
      .get(`/api/v1/projects/${projectId}/integrations/${integrationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(JSON.stringify(getRes.body)).not.toContain('ghp_rotated_token');
    expect(getRes.body.credentials_encrypted).toBeUndefined();
  });
});
