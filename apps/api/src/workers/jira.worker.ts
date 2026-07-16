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

    const jiraConfig = { type: 'JIRA' as const, ...config };

    const issues = await jiraAdapter.fetchIssues(jiraConfig, credentials, since ? new Date(since) : undefined);

    // Sprints are board-scoped and only fetched when a boardId is configured — projects
    // without a board (or not using Scrum boards) keep working with sprint_id left null.
    // Best-effort: a board that doesn't support sprints (Kanban), a stale boardId, or any
    // other sprint-side failure shouldn't discard an otherwise-successful issue sync.
    const issueKeyToSprintId = new Map<string, string>();
    try {
      const sprints = await jiraAdapter.fetchSprints(jiraConfig, credentials);

      for (const sprint of sprints) {
        const [{ id: sprintId }] = await db('sprints')
          .insert({
            id: uuidv4(),
            organization_id: organizationId,
            project_id: projectId,
            external_id: sprint.externalId,
            name: sprint.name,
            state: sprint.state,
            start_date: sprint.startDate ?? null,
            end_date: sprint.endDate ?? null,
            complete_date: sprint.completeDate ?? null,
            goal: sprint.goal ?? null,
            synced_at: db.fn.now(),
          })
          .onConflict(['project_id', 'external_id'])
          .merge(['name', 'state', 'start_date', 'end_date', 'complete_date', 'goal', 'synced_at'])
          .returning('id');

        const issueKeys = await jiraAdapter.fetchSprintIssueKeys(jiraConfig, credentials, sprint.externalId);
        for (const key of issueKeys) issueKeyToSprintId.set(key, sprintId);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await job.log(`Sprint sync skipped: ${msg}`);
    }

    // Map Jira's accountId (issue.assigneeId) to our internal contributor — mirrors the
    // matching github.worker.ts already does via github_username, just never existed here.
    const contributors = await db('contributors')
      .where({ organization_id: organizationId, project_id: projectId, deleted_at: null })
      .whereNotNull('jira_account_id')
      .select('id', 'jira_account_id');
    const jiraAccountToContributorId = new Map(contributors.map((c) => [c.jira_account_id as string, c.id as string]));

    // Upsert each issue snapshot — same external key in same project = update, not insert
    for (const issue of issues) {
      await db('issue_snapshots')
        .insert({
          id: uuidv4(),
          organization_id: organizationId,
          project_id: projectId,
          sprint_id: issueKeyToSprintId.get(issue.externalKey) ?? null,
          assignee_contributor_id: issue.assigneeId ? jiraAccountToContributorId.get(issue.assigneeId) ?? null : null,
          external_key: issue.externalKey,
          summary: issue.summary,
          status: issue.status,
          issue_type: issue.issueType,
          priority: issue.priority ?? null,
          labels: issue.labels,
          raw_payload: issue.rawPayload ? JSON.stringify(issue.rawPayload) : null,
          created_date: issue.createdDate ?? null,
          updated_date: issue.updatedDate ?? null,
          synced_at: db.fn.now(),
        })
        .onConflict(['project_id', 'external_key'])
        .merge(['sprint_id', 'assignee_contributor_id', 'summary', 'status', 'issue_type', 'priority', 'labels', 'raw_payload', 'updated_date', 'synced_at']);
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
