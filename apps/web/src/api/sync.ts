import { api } from './client.js';

export interface SyncJob {
  id: string;
  type: 'JIRA_SYNC' | 'GITHUB_SYNC' | 'COMPUTE_METRICS' | 'FULL_SYNC';
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  triggeredBy: 'SCHEDULE' | 'MANUAL';
  startedAt: string | null;
  completedAt: string | null;
  recordsProcessed: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export const syncApi = {
  listJobs: (projectId: string) =>
    api.get(`projects/${projectId}/sync`).json<SyncJob[]>(),

  getJob: (projectId: string, syncJobId: string) =>
    api.get(`projects/${projectId}/sync/${syncJobId}`).json<SyncJob>(),

  triggerSync: (projectId: string, since?: string) =>
    api.post(`projects/${projectId}/sync`, { json: since ? { since } : {} })
      .json<{ jiraSyncJobId: string | null; githubSyncJobId: string | null; metricsJobId: string | null }>(),
};
