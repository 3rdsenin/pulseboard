import { Worker, type Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { IntegrationService } from '../services/integration.service.js';
import { JiraAdapter } from '../adapters/jira.adapter.js';
import { workerConnection } from './queues.js';

export interface JiraSyncJobData {
  projectId: string;
  organizationId: string;
  integrationId: string;
  since?: string; // ISO date — omit for full re-sync
  syncJobId: string;
}

const integrationService = new IntegrationService();
const jiraAdapter = new JiraAdapter();

async function processJiraSync(job: Job<JiraSyncJobData>) {
  const { projectId, organizationId, integrationId, since, syncJobId } = job.data;

  await db('sync_jobs').where({ id: syncJobId }).update({
    status: 'RUNNING',
    started_at: db.fn.now(),
  });

  try {
    const integration = await db('integrations')
      .where({ id: integrationId, organization_id: organizationId, deleted_at: null })
      .first('config');

    if (!integration) throw new Error('Integration not found');

    const credentials = await integrationService.getDecryptedCredentials(integrationId);
    const config = integration.config as Record<string, unknown>;

    const issues = await jiraAdapter.fetchIssues(
      { type: 'JIRA', ...config },
      credentials,
      since ? new Date(since) : undefined
    );

    // Upsert each issue snapshot — same external key in same project = update, not insert
    for (const issue of issues) {
      await db('issue_snapshots')
        .insert({
          id: uuidv4(),
          organization_id: organizationId,
          project_id: projectId,
          external_key: issue.externalKey,
          summary: issue.summary,
          status: issue.status,
          issue_type: issue.issueType,
          priority: issue.priority ?? null,
          labels: JSON.stringify(issue.labels),
          raw_payload: issue.rawPayload ? JSON.stringify(issue.rawPayload) : null,
          created_date: issue.createdDate ?? null,
          updated_date: issue.updatedDate ?? null,
          synced_at: db.fn.now(),
        })
        .onConflict(['project_id', 'external_key'])
        .merge(['summary', 'status', 'issue_type', 'priority', 'labels', 'raw_payload', 'updated_date', 'synced_at']);
    }

    await db('sync_jobs').where({ id: syncJobId }).update({
      status: 'SUCCESS',
      completed_at: db.fn.now(),
      records_processed: issues.length,
    });

    await integrationService.markTestResult(integrationId, true);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await db('sync_jobs').where({ id: syncJobId }).update({
      status: 'FAILED',
      completed_at: db.fn.now(),
      error_message: msg,
    });
    await integrationService.markTestResult(integrationId, false, msg);
    throw error; // re-throw so BullMQ marks the job as failed and can retry
  }
}

export function startJiraWorker() {
  return new Worker<JiraSyncJobData>('jira-sync', processJiraSync, {
    connection: workerConnection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
  });
}
