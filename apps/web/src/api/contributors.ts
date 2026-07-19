import { api } from './client.js';

export interface Contributor {
  id: string;
  display_name: string;
  email: string | null;
  jira_account_id: string | null;
  github_username: string | null;
  role_label: string | null;
  is_active: boolean;
  created_at: string;
  aliases?: Array<{ id: string; alias: string; created_at: string }>;
}

export interface CreateContributorInput {
  displayName: string;
  email?: string;
  jiraAccountId?: string;
  githubUsername?: string;
  roleLabel?: string;
}

export interface UpdateContributorInput {
  displayName?: string;
  email?: string;
  jiraAccountId?: string;
  githubUsername?: string;
  roleLabel?: string;
  isActive?: boolean;
}

export const contributorsApi = {
  list: (projectId: string, includeInactive = false) =>
    api
      .get(`projects/${projectId}/contributors`, {
        searchParams: { includeInactive: String(includeInactive) },
      })
      .json<Contributor[]>(),

  get: (projectId: string, contributorId: string) =>
    api
      .get(`projects/${projectId}/contributors/${contributorId}`)
      .json<Contributor>(),

  create: (projectId: string, input: CreateContributorInput) =>
    api
      .post(`projects/${projectId}/contributors`, { json: input })
      .json<Contributor>(),

  update: (
    projectId: string,
    contributorId: string,
    input: UpdateContributorInput
  ) =>
    api
      .patch(`projects/${projectId}/contributors/${contributorId}`, {
        json: input,
      })
      .json<Contributor>(),

  delete: (projectId: string, contributorId: string) =>
    api.delete(`projects/${projectId}/contributors/${contributorId}`),

  addAlias: (projectId: string, contributorId: string, alias: string) =>
    api
      .post(`projects/${projectId}/contributors/${contributorId}/aliases`, {
        json: { alias },
      })
      .json<{ id: string; alias: string; created_at: string }>(),

  removeAlias: (projectId: string, contributorId: string, aliasId: string) =>
    api.delete(
      `projects/${projectId}/contributors/${contributorId}/aliases/${aliasId}`
    ),
};
