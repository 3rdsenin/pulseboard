import { api } from './client.js';
import type { Sprint, ContributorMetrics, Issue, PaginatedResponse, FeatureBreakdown } from './dashboard.js';
import type { Rating } from './ratings.js';
import type { Contributor } from './contributors.js';

export interface ShareMetadata {
  projectId: string;
  projectName: string;
  isPublic: boolean;
}

export interface ShareResponse {
  shareToken: string;
  url: string;
  isPublic: boolean;
}

export const shareApi = {
  createShareLink: (projectId: string, input: { isPublic: boolean }) =>
    api.post(`projects/${projectId}/share`, { json: input }).json<ShareResponse>(),

  getMetadata: (shareToken: string) =>
    api.get(`share/${shareToken}`).json<ShareMetadata>(),

  listSprints: (shareToken: string) =>
    api.get(`share/${shareToken}/sprints`).json<Sprint[]>(),

  listContributors: (shareToken: string) =>
    api.get(`share/${shareToken}/contributors`).json<Contributor[]>(),

  getProjectOverview: (shareToken: string) =>
    api.get(`share/${shareToken}/overview`).json<ContributorMetrics[]>(),

  getSprintMetrics: (shareToken: string, sprintId: string) =>
    api.get(`share/${shareToken}/sprints/${sprintId}/metrics`).json<ContributorMetrics[]>(),

  getSprintRatings: (shareToken: string, sprintId: string) =>
    api.get(`share/${shareToken}/sprints/${sprintId}/ratings`).json<Rating[]>(),

  getFeatureBreakdown: (shareToken: string, sprintId?: string) =>
    api
      .get(`share/${shareToken}/features/breakdown`, {
        searchParams: sprintId ? { sprintId } : undefined,
      })
      .json<FeatureBreakdown[]>(),

  getProjectIssues: (
    shareToken: string,
    filters: {
      status?: string;
      type?: string;
      priority?: string;
      assigneeId?: string;
      sprintId?: string;
      q?: string;
      page?: number;
      perPage?: number;
    }
  ) =>
    api
      .get(`share/${shareToken}/issues`, {
        searchParams: Object.entries(filters)
          .filter(([_, v]) => v !== undefined && v !== '')
          .reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
      })
      .json<PaginatedResponse<Issue>>(),
};
