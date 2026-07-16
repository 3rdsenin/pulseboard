import { Worker, type Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { workerConnection } from './queues.js';
import { ScoringService } from '../services/scoring.service.js';

export interface ComputeMetricsJobData {
  projectId: string;
  organizationId: string;
  sprintId: string;
  syncJobId: string;
}

const scoringService = new ScoringService();

async function computeMetrics(job: Job<ComputeMetricsJobData>) {
  const { projectId, organizationId, sprintId, syncJobId } = job.data;

  await db('sync_jobs').where({ id: syncJobId }).update({
    status: 'RUNNING',
    started_at: db.fn.now(),
  });

  try {
    const contributors = await db('contributors')
      .where({ organization_id: organizationId, project_id: projectId, is_active: true, deleted_at: null })
      .select('id');

    const sprint = await db('sprints').where({ id: sprintId }).first('start_date', 'end_date');
    if (!sprint) throw new Error('Sprint not found');

    // Collect per-contributor issue counts from issue_snapshots for this sprint period
    const rows: Array<{
      contributorId: string;
      issuesTotal: number;
      issuesDone: number;
      issuesHighPriority: number;
      issuesInProgress: number;
    }> = [];

    for (const { id: contributorId } of contributors) {
      const counts = await db('issue_snapshots')
        .where({ project_id: projectId, assignee_contributor_id: contributorId, sprint_id: sprintId })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw(`SUM(CASE WHEN status ILIKE '%done%' OR status ILIKE '%closed%' THEN 1 ELSE 0 END) as done`),
          db.raw(`SUM(CASE WHEN priority IN ('High', 'Highest', 'Critical') THEN 1 ELSE 0 END) as high_priority`),
          db.raw(`SUM(CASE WHEN status ILIKE '%in progress%' THEN 1 ELSE 0 END) as in_progress`)
        )
        .first();

      const issuesTotal = Number(counts?.total ?? 0);
      const issuesDone = Number(counts?.done ?? 0);
      const issuesHighPriority = Number(counts?.high_priority ?? 0);
      const issuesInProgress = Number(counts?.in_progress ?? 0);

      rows.push({ contributorId, issuesTotal, issuesDone, issuesHighPriority, issuesInProgress });
    }

    const scored = scoringService.computeScores(rows);

    for (const s of scored) {
      await db('contributor_sprint_metrics')
        .insert({
          id: uuidv4(),
          organization_id: organizationId,
          project_id: projectId,
          contributor_id: s.contributorId,
          sprint_id: sprintId,
          issues_total: s.issuesTotal,
          issues_done: s.issuesDone,
          issues_high_priority: s.issuesHighPriority,
          issues_in_progress: s.issuesInProgress,
          delivery_score: s.deliveryScore.toFixed(2),
          volume_score: s.volumeScore.toFixed(2),
          high_priority_score: s.highPriorityScore.toFixed(2),
          weighted_score: s.weightedScore.toFixed(2),
          sprint_rank: s.sprintRank,
          computed_at: db.fn.now(),
        })
        .onConflict(['project_id', 'contributor_id', 'sprint_id'])
        .merge(['issues_total', 'issues_done', 'issues_high_priority', 'issues_in_progress',
          'delivery_score', 'volume_score', 'high_priority_score', 'weighted_score', 'sprint_rank', 'computed_at']);
    }

    await db('sync_jobs').where({ id: syncJobId }).update({
      status: 'SUCCESS',
      completed_at: db.fn.now(),
      records_processed: scored.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await db('sync_jobs').where({ id: syncJobId }).update({
      status: 'FAILED',
      completed_at: db.fn.now(),
      error_message: msg,
    });
    throw error;
  }
}

export function startMetricsWorker() {
  return new Worker<ComputeMetricsJobData>('compute-metrics', computeMetrics, {
    connection: workerConnection,
    concurrency: 2, // metrics are CPU-heavy; keep concurrency low
  });
}
