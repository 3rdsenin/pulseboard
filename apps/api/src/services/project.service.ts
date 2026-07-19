import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { CreateProjectInput, UpdateProjectInput } from '@pulseboard/shared';

export class ProjectService {
  async listProjects(organizationId: string, userId: string, orgRole: string) {
    const query = db('projects as p')
      .where({ 'p.organization_id': organizationId, 'p.deleted_at': null });

    if (orgRole !== 'ORG_ADMIN') {
      query
        .join('project_members as pm', function () {
          this.on('pm.project_id', 'p.id')
            .andOn('pm.user_id', db.raw('?', [userId]))
            .andOnNull('pm.deleted_at');
        });
    }

    return query.select(
      'p.id',
      'p.name',
      'p.slug',
      'p.sync_cron as syncCron',
      'p.last_synced_at as lastSyncedAt',
      'p.created_at as createdAt'
    );
  }

  async getProject(organizationId: string, projectId: string) {
    return db('projects')
      .where({ id: projectId, organization_id: organizationId, deleted_at: null })
      .first('id', 'name', 'slug', 'sync_cron', 'last_synced_at', 'settings', 'created_at');
  }

  async createProject(organizationId: string, input: CreateProjectInput, actorId: string) {
    const slugTaken = await db('projects')
      .where({ organization_id: organizationId, slug: input.slug, deleted_at: null })
      .first('id');
    if (slugTaken) {
      throw Object.assign(new Error('A project with this slug already exists'), { statusCode: 409 });
    }

    const [project] = await db('projects')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        name: input.name,
        slug: input.slug,
        sync_cron: input.syncCron ?? '0 2 * * *',
        created_by: actorId,
      })
      .returning(['id', 'name', 'slug', 'sync_cron', 'created_at']);

    await db('project_members').insert({
      id: uuidv4(),
      project_id: project.id,
      user_id: actorId,
      role: 'PROJECT_ADMIN',
      created_by: actorId,
    });

    return project;
  }

  async updateProject(organizationId: string, projectId: string, input: UpdateProjectInput) {
    const updates: Record<string, unknown> = { updated_at: db.fn.now() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.syncCron !== undefined) updates.sync_cron = input.syncCron;
    if (input.settings !== undefined) updates.settings = JSON.stringify(input.settings);

    const [updated] = await db('projects')
      .where({ id: projectId, organization_id: organizationId, deleted_at: null })
      .update(updates)
      .returning(['id', 'name', 'slug', 'sync_cron', 'settings']);

    return updated ?? null;
  }

  async deleteProject(organizationId: string, projectId: string) {
    const affected = await db('projects')
      .where({ id: projectId, organization_id: organizationId, deleted_at: null })
      .update({ deleted_at: db.fn.now() });
    if (!affected) {
      throw Object.assign(new Error('Project not found'), { statusCode: 404 });
    }
  }

  async listMembers(organizationId: string, projectId: string) {
    return db('project_members as pm')
      .join('users as u', 'u.id', 'pm.user_id')
      .where({
        'pm.project_id': projectId,
        'pm.deleted_at': null,
        'u.deleted_at': null,
      })
      .select(
        'pm.id',
        'u.id as userId',
        'u.name',
        'u.email',
        'u.avatar_url as avatarUrl',
        'pm.role',
        'pm.created_at as addedAt'
      );
  }

  async addMember(
    organizationId: string,
    projectId: string,
    userId: string,
    role: 'PROJECT_ADMIN' | 'PROJECT_VIEWER',
    actorId: string
  ) {
    const orgMember = await db('organization_members')
      .where({ organization_id: organizationId, user_id: userId, deleted_at: null })
      .first('id');
    if (!orgMember) {
      throw Object.assign(new Error('User is not a member of this organisation'), { statusCode: 400 });
    }

    const existing = await db('project_members')
      .where({ project_id: projectId, user_id: userId })
      .first('id', 'deleted_at');
    if (existing && !existing.deleted_at) {
      throw Object.assign(new Error('User is already a member of this project'), { statusCode: 409 });
    }

    // project_members has a unique (project_id, user_id) constraint with no deleted_at
    // exclusion, so a previously removed member must be revived, not re-inserted, or the
    // insert throws a unique-violation 500 the next time they're added back.
    if (existing) {
      await db('project_members')
        .where({ id: existing.id })
        .update({ role, deleted_at: null, created_by: actorId, created_at: db.fn.now() });
      return;
    }

    await db('project_members').insert({
      id: uuidv4(),
      project_id: projectId,
      user_id: userId,
      role,
      created_by: actorId,
    });
  }

  async removeMember(projectId: string, targetUserId: string, actorId: string) {
    if (targetUserId === actorId) {
      throw Object.assign(new Error('Cannot remove yourself from a project'), { statusCode: 400 });
    }
    const affected = await db('project_members')
      .where({ project_id: projectId, user_id: targetUserId, deleted_at: null })
      .update({ deleted_at: db.fn.now() });
    if (!affected) {
      throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    }
  }

  async updateMemberRole(
    projectId: string,
    targetUserId: string,
    role: 'PROJECT_ADMIN' | 'PROJECT_VIEWER'
  ) {
    const affected = await db('project_members')
      .where({ project_id: projectId, user_id: targetUserId, deleted_at: null })
      .update({ role });
    if (!affected) {
      throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    }
  }
}
