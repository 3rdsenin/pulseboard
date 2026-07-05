import { Worker, type Job } from 'bullmq';
import db from '../db/index.js';
import { IntegrationService } from '../services/integration.service.js';
import { GitHubAdapter } from '../adapters/github.adapter.js';
import { workerConnection } from './queues.js';

export interface GitHubSyncJobData {
  projectId: string;
  organizationId: string;
  integrationId: string;
  since?: string;
  syncJobId: string;
}

const integrationService = new IntegrationService();
const githubAdapter = new GitHubAdapter();

async function processGitHubSync(job: Job<GitHubSyncJobData>) {
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

    const commits = await githubAdapter.fetchCommits(
      { type: 'GITHUB', ...config },
      credentials,
      since ? new Date(since) : undefined
    );

    // Match commits to contributors by github_username or author email alias.
    // Unmatched commits are stored with null contributor — the metrics worker skips them.
    let matched = 0;
    for (const commit of commits) {
      const contributor = await db('contributors')
        .where({ organization_id: organizationId, project_id: projectId, deleted_at: null })
        .where(function () {
          this.where('github_username', commit.authorName)
            .orWhereExists(
              db('contributor_name_aliases')
                .where('contributor_id', db.ref('contributors.id'))
                .where('alias', commit.authorName ?? '')
            );
        })
        .first('id');

      if (contributor) matched++;

      // Commits are lightweight reference data — stored as raw JSON in contributor_sprint_metrics
      // via the metrics worker; we don't create a separate commit table to keep schema lean.
      await db.raw(`
        UPDATE contributor_sprint_metrics
        SET commit_count = commit_count + 1,
            repos_contributed = CASE
              WHEN NOT (? = ANY(repos_contributed)) THEN array_append(repos_contributed, ?)
              ELSE repos_contributed
            END,
            last_commit_date = GREATEST(last_commit_date, ?::date)
        WHERE contributor_id = ? AND project_id = ?
          AND sprint_id = (
            SELECT id FROM sprints
            WHERE project_id = ?
              AND state = 'ACTIVE'
            LIMIT 1
          )
      `, [commit.repo, commit.repo, commit.committedAt, contributor?.id ?? null, projectId, projectId]);
    }

    await db('sync_jobs').where({ id: syncJobId }).update({
      status: 'SUCCESS',
      completed_at: db.fn.now(),
      records_processed: commits.length,
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
    throw error;
  }
}

export function startGitHubWorker() {
  return new Worker<GitHubSyncJobData>('github-sync', processGitHubSync, {
    connection: workerConnection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
  });
}
