import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

interface CreateContributorInput {
  displayName: string;
  email?: string;
  jiraAccountId?: string;
  githubUsername?: string;
  roleLabel?: string;
}

interface UpdateContributorInput {
  displayName?: string;
  email?: string;
  jiraAccountId?: string;
  githubUsername?: string;
  roleLabel?: string;
  isActive?: boolean;
}

export class ContributorService {
  async listContributors(organizationId: string, projectId: string, includeInactive = false) {
    const query = db('contributors')
      .where({ organization_id: organizationId, project_id: projectId, deleted_at: null });

    if (!includeInactive) {
      query.where({ is_active: true });
    }

    return query.select(
      'id', 'display_name', 'email', 'jira_account_id',
      'github_username', 'role_label', 'is_active', 'created_at'
    );
  }

  async getContributor(organizationId: string, projectId: string, contributorId: string) {
    const contributor = await db('contributors')
      .where({ id: contributorId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .first('id', 'display_name', 'email', 'jira_account_id', 'github_username', 'role_label', 'is_active', 'created_at');

    if (!contributor) return null;

    const aliases = await db('contributor_name_aliases')
      .where({ contributor_id: contributorId })
      .select('id', 'alias', 'created_at');

    return { ...contributor, aliases };
  }

  async createContributor(
    organizationId: string,
    projectId: string,
    input: CreateContributorInput,
    actorId: string
  ) {
    const [contributor] = await db('contributors')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        display_name: input.displayName,
        email: input.email ?? null,
        jira_account_id: input.jiraAccountId ?? null,
        github_username: input.githubUsername ?? null,
        role_label: input.roleLabel ?? null,
        is_active: true,
        created_by: actorId,
      })
      .returning(['id', 'display_name', 'email', 'jira_account_id', 'github_username', 'role_label', 'is_active', 'created_at']);

    return contributor;
  }

  async updateContributor(
    organizationId: string,
    projectId: string,
    contributorId: string,
    input: UpdateContributorInput
  ) {
    const updates: Record<string, unknown> = { updated_at: db.fn.now() };
    if (input.displayName !== undefined) updates.display_name = input.displayName;
    if (input.email !== undefined) updates.email = input.email;
    if (input.jiraAccountId !== undefined) updates.jira_account_id = input.jiraAccountId;
    if (input.githubUsername !== undefined) updates.github_username = input.githubUsername;
    if (input.roleLabel !== undefined) updates.role_label = input.roleLabel;
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    const [updated] = await db('contributors')
      .where({ id: contributorId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .update(updates)
      .returning(['id', 'display_name', 'email', 'jira_account_id', 'github_username', 'role_label', 'is_active']);

    return updated ?? null;
  }

  // Soft-delete; active contributor records (metrics, ratings) remain queryable by sprint
  async deleteContributor(organizationId: string, projectId: string, contributorId: string) {
    const affected = await db('contributors')
      .where({ id: contributorId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .update({ deleted_at: db.fn.now() });
    if (!affected) {
      throw Object.assign(new Error('Contributor not found'), { statusCode: 404 });
    }
  }

  async addAlias(contributorId: string, alias: string, actorId: string) {
    const existing = await db('contributor_name_aliases')
      .where({ contributor_id: contributorId, alias })
      .first('id');
    if (existing) {
      throw Object.assign(new Error('Alias already exists for this contributor'), { statusCode: 409 });
    }

    const [row] = await db('contributor_name_aliases')
      .insert({ id: uuidv4(), contributor_id: contributorId, alias, created_by: actorId })
      .returning(['id', 'alias', 'created_at']);

    return row;
  }

  async removeAlias(contributorId: string, aliasId: string) {
    const affected = await db('contributor_name_aliases')
      .where({ id: aliasId, contributor_id: contributorId })
      .delete();
    if (!affected) {
      throw Object.assign(new Error('Alias not found'), { statusCode: 404 });
    }
  }
}
