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
      .json<{ jiraSyncJobId: string | null; githubSyncJobId: string | null; metricsJobIds: string[] }>(),

  // Polls a sync job until it reaches a terminal state — sync and metrics jobs run async
  // on a real delay (a full Jira sync can take tens of seconds; metrics jobs are queued
  // with an explicit 60s delay), so callers must wait for completion rather than guessing
  // a fixed timeout before refetching dependent data.
  waitForJob: async (projectId: string, syncJobId: string, timeoutMs = 120_000): Promise<SyncJob> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = await syncApi.getJob(projectId, syncJobId);
      if (job.status === 'SUCCESS' || job.status === 'FAILED' || job.status === 'CANCELLED') return job;
      if (Date.now() >= deadline) return job;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  },
};
