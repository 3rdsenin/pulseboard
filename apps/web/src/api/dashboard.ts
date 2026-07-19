import { api } from './client.js';

export interface Sprint {
  id: string;
  name: string;
  state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
  startDate: string | null;
  endDate: string | null;
  completeDate: string | null;
  goal: string | null;
}

export interface ContributorMetrics {
  contributorId: string;
  displayName: string;
  roleLabel: string | null;
  githubUsername: string | null;
  weightedScore: string | null;
  deliveryScore: string | null;
  volumeScore: string | null;
  highPriorityScore: string | null;
  issuesTotal: number;
  issuesDone: number;
  issuesHighPriority: number;
  issuesInProgress: number;
  commitCount: number;
  reposContributed: string[];
  sprintRank: number | null;
  computedAt: string | null;
}

export interface Issue {
  id: string;
  key: string;
  summary: string;
  status: string;
  type: string;
  priority: string | null;
  assigneeId: string | null;
  sprintId: string | null;
  updatedAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  };
}

export interface FeatureBreakdown {
  id: string;
  name: string;
  color: string | null;
  total: number;
  done: number;
  completionRate: number;
}

export const dashboardApi = {
  // Contributor stats across ALL synced issues, independent of sprints — always available,
  // even for projects with zero sprints (e.g. a Kanban board with no sprint concept at all).
  getProjectOverview: (projectId: string) =>
    api.get(`projects/${projectId}/overview`).json<ContributorMetrics[]>(),

  listSprints: (projectId: string) =>
    api.get(`projects/${projectId}/sprints`).json<Sprint[]>(),

  getSprintMetrics: (projectId: string, sprintId: string) =>
    api.get(`projects/${projectId}/sprints/${sprintId}/metrics`).json<ContributorMetrics[]>(),

  getContributorIssues: (projectId: string, sprintId: string, contributorId: string) =>
    api.get(`projects/${projectId}/sprints/${sprintId}/contributors/${contributorId}/issues`).json<unknown[]>(),

  getProjectIssues: (
    projectId: string,
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
      .get(`projects/${projectId}/issues`, {
        searchParams: Object.entries(filters)
          .filter(([_, v]) => v !== undefined && v !== '')
          .reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
      })
      .json<PaginatedResponse<Issue>>(),

  getFeatureBreakdown: (projectId: string, sprintId?: string) =>
    api
      .get(`projects/${projectId}/features/breakdown`, {
        searchParams: sprintId ? { sprintId } : undefined,
      })
      .json<FeatureBreakdown[]>(),
};
