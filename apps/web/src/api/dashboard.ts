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

export const dashboardApi = {
  // Contributor stats across ALL synced issues, independent of sprints — always available,
  // even for projects with zero sprints (e.g. a Kanban board with no sprint concept).
  getProjectOverview: (projectId: string) =>
    api.get(`projects/${projectId}/overview`).json<ContributorMetrics[]>(),

  listSprints: (projectId: string) =>
    api.get(`projects/${projectId}/sprints`).json<Sprint[]>(),

  getSprintMetrics: (projectId: string, sprintId: string) =>
    api.get(`projects/${projectId}/sprints/${sprintId}/metrics`).json<ContributorMetrics[]>(),

  getContributorIssues: (projectId: string, sprintId: string, contributorId: string) =>
    api.get(`projects/${projectId}/sprints/${sprintId}/contributors/${contributorId}/issues`).json<unknown[]>(),
};
