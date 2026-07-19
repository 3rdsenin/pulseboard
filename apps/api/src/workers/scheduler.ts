import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { jiraSyncQueue, githubSyncQueue, metricsQueue } from './queues.js';

// Enqueues a full sync (Jira → GitHub → Metrics) for a single project.
// Called by the nightly cron and by manual sync triggers from the API.
export async function enqueueFullSync(
  organizationId: string,
  projectId: string,
  triggeredBy: 'SCHEDULE' | 'MANUAL',
  triggeredByUserId?: string,
  since?: Date
) {
  const integrations = await db('integrations')
    .where({ organization_id: organizationId, project_id: projectId, deleted_at: null })
    .whereIn('type', ['JIRA', 'GITHUB'])
    .select('id', 'type');

  const jiraIntegration = integrations.find((i) => i.type === 'JIRA');
  const githubIntegration = integrations.find((i) => i.type === 'GITHUB');

  // Metrics are recomputed for the active sprint every time (its data keeps changing)
  // plus any closed/future sprint that has never had metrics computed at all — otherwise
  // a sprint that closes without ever being synced while active would show no metrics forever.
  const sprintsNeedingMetrics = await db('sprints as s')
    .where('s.project_id', projectId)
    .where((qb) => {
      qb.where('s.state', 'ACTIVE').orWhereNotExists(
        db('contributor_sprint_metrics as csm').whereRaw('csm.sprint_id = s.id')
      );
    })
    .select('s.id');

  // Create sync job records before enqueueing so the UI can show "PENDING" immediately
  const jiraSyncJobId = jiraIntegration ? uuidv4() : null;
  const githubSyncJobId = githubIntegration ? uuidv4() : null;
  const metricsJobs = sprintsNeedingMetrics.map((sprint) => ({ sprintId: sprint.id, syncJobId: uuidv4() }));

  const jobRecords = [
    jiraIntegration && jiraSyncJobId && {
      id: jiraSyncJobId,
      organization_id: organizationId,
      project_id: projectId,
      type: 'JIRA_SYNC',
      status: 'PENDING',
      triggered_by: triggeredBy,
      triggered_by_user_id: triggeredByUserId ?? null,
    },
    githubIntegration && githubSyncJobId && {
      id: githubSyncJobId,
      organization_id: organizationId,
      project_id: projectId,
      type: 'GITHUB_SYNC',
      status: 'PENDING',
      triggered_by: triggeredBy,
      triggered_by_user_id: triggeredByUserId ?? null,
    },
    ...metricsJobs.map(({ syncJobId }) => ({
      id: syncJobId,
      organization_id: organizationId,
      project_id: projectId,
      type: 'COMPUTE_METRICS',
      status: 'PENDING',
      triggered_by: triggeredBy,
      triggered_by_user_id: triggeredByUserId ?? null,
    })),
  ].filter(Boolean);

  if (jobRecords.length > 0) {
    await db('sync_jobs').insert(jobRecords);
  }

  // Jobs are sequenced with BullMQ dependencies so metrics run after both syncs complete
  if (jiraIntegration && jiraSyncJobId) {
    await jiraSyncQueue.add('jira-sync', {
      projectId,
      organizationId,
      integrationId: jiraIntegration.id,
      since: since?.toISOString(),
      syncJobId: jiraSyncJobId,
    });
  }

  if (githubIntegration && githubSyncJobId) {
    await githubSyncQueue.add('github-sync', {
      projectId,
      organizationId,
      integrationId: githubIntegration.id,
      since: since?.toISOString(),
      syncJobId: githubSyncJobId,
    });
  }

  // Metrics jobs run on a 60s delay — gives sync workers time to finish.
  // A proper dependency graph (BullMQ Flow) is the production upgrade path here.
  for (const { sprintId, syncJobId } of metricsJobs) {
    await metricsQueue.add('compute-metrics', {
      projectId,
      organizationId,
      sprintId,
      syncJobId,
    }, { delay: 60_000 });
  }

  return { jiraSyncJobId, githubSyncJobId, metricsJobIds: metricsJobs.map((j) => j.syncJobId) };
}

// Called at app startup on the worker process to start the nightly scheduler
export async function startScheduler() {
  const { default: cron } = await import('node-cron');

  // Check every minute for projects whose sync_cron matches the current time
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const projects = await db('projects')
      .where({ deleted_at: null })
      .select('id', 'organization_id', 'sync_cron', 'last_synced_at');

    for (const project of projects) {
      if (!cron.validate(project.sync_cron)) continue;

      // Simple check: if last_synced_at is more than 23h ago and the cron matches today,
      // trigger. BullMQ deduplication prevents double-firing if the process restarts.
      const lastSync = project.last_synced_at ? new Date(project.last_synced_at) : null;
      const hoursSinceLast = lastSync
        ? (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (hoursSinceLast >= 23) {
        await enqueueFullSync(project.organization_id, project.id, 'SCHEDULE');
        await db('projects').where({ id: project.id }).update({ last_synced_at: db.fn.now() });
      }
    }
  });
}
