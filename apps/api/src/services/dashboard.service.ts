import db from '../db/index.js';
import { ScoringService } from './scoring.service.js';

const scoringService = new ScoringService();

export class DashboardService {
  // Project-wide contributor stats across ALL synced issues, independent of sprints.
  // Sprints are an additive lens (per-sprint breakdown, trends) — a project must still be
  // fully viewable with zero sprints (e.g. a Kanban board with no sprint concept at all).
  async getProjectOverview(organizationId: string, projectId: string) {
    const contributors = await db('contributors')
      .where({ organization_id: organizationId, project_id: projectId, is_active: true, deleted_at: null })
      .select('id', 'display_name', 'role_label', 'github_username');

    const rows: Array<{
      contributorId: string;
      issuesTotal: number;
      issuesDone: number;
      issuesHighPriority: number;
      issuesInProgress: number;
    }> = [];

    for (const c of contributors) {
      const counts = await db('issue_snapshots')
        .where({ project_id: projectId, assignee_contributor_id: c.id })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw(`SUM(CASE WHEN status ILIKE '%done%' OR status ILIKE '%closed%' THEN 1 ELSE 0 END) as done`),
          db.raw(`SUM(CASE WHEN priority IN ('High', 'Highest', 'Critical') THEN 1 ELSE 0 END) as high_priority`),
          db.raw(`SUM(CASE WHEN status ILIKE '%in progress%' THEN 1 ELSE 0 END) as in_progress`)
        )
        .first();

      rows.push({
        contributorId: c.id,
        issuesTotal: Number(counts?.total ?? 0),
        issuesDone: Number(counts?.done ?? 0),
        issuesHighPriority: Number(counts?.high_priority ?? 0),
        issuesInProgress: Number(counts?.in_progress ?? 0),
      });
    }

    const scored = scoringService.computeScores(rows);
    const byId = new Map(contributors.map((c) => [c.id, c]));

    // commitCount/reposContributed aren't tracked outside sprint scope yet — GitHub sync
    // only ever increments an existing contributor_sprint_metrics row for the active sprint,
    // so there's no raw commit data to aggregate here. Known gap, not fixed in this pass.
    return scored.map((s) => {
      const c = byId.get(s.contributorId)!;
      return {
        contributorId: s.contributorId,
        displayName: c.display_name,
        roleLabel: c.role_label,
        githubUsername: c.github_username,
        weightedScore: s.weightedScore,
        deliveryScore: s.deliveryScore,
        volumeScore: s.volumeScore,
        highPriorityScore: s.highPriorityScore,
        issuesTotal: s.issuesTotal,
        issuesDone: s.issuesDone,
        issuesHighPriority: s.issuesHighPriority,
        issuesInProgress: s.issuesInProgress,
        commitCount: 0,
        reposContributed: [] as string[],
        sprintRank: s.sprintRank,
        computedAt: null as string | null,
      };
    });
  }

  async listSprints(organizationId: string, projectId: string) {
    return db('sprints')
      .where({ organization_id: organizationId, project_id: projectId })
      .orderBy('start_date', 'desc')
      .select(
        'id', 'name', 'state', 'goal',
        'start_date as startDate',
        'end_date as endDate',
        'complete_date as completeDate',
        'synced_at as syncedAt'
      );
  }

  async getSprintMetrics(organizationId: string, projectId: string, sprintId: string) {
    // Single query joining contributors with their sprint metrics.
    // Contributors with no metrics row yet appear with null scores (first sync pending).
    const rows = await db('contributors as c')
      .leftJoin('contributor_sprint_metrics as csm', function () {
        this.on('csm.contributor_id', 'c.id')
          .andOn('csm.sprint_id', db.raw('?', [sprintId]));
      })
      .where({
        'c.organization_id': organizationId,
        'c.project_id': projectId,
        'c.is_active': true,
        'c.deleted_at': null,
      })
      .orderByRaw('csm.sprint_rank ASC NULLS LAST, c.display_name ASC')
      .select(
        'c.id as contributorId',
        'c.display_name as displayName',
        'c.role_label as roleLabel',
        'c.github_username as githubUsername',
        'csm.weighted_score as weightedScore',
        'csm.delivery_score as deliveryScore',
        'csm.volume_score as volumeScore',
        'csm.high_priority_score as highPriorityScore',
        'csm.issues_total as issuesTotal',
        'csm.issues_done as issuesDone',
        'csm.issues_high_priority as issuesHighPriority',
        'csm.issues_in_progress as issuesInProgress',
        'csm.commit_count as commitCount',
        'csm.repos_contributed as reposContributed',
        'csm.sprint_rank as sprintRank',
        'csm.computed_at as computedAt'
      );

    return rows;
  }

  // Returns issue-level detail for a single contributor in a sprint — used for drill-down
  async getContributorIssues(
    organizationId: string,
    projectId: string,
    contributorId: string,
    sprintId: string
  ) {
    return db('issue_snapshots')
      .where({
        organization_id: organizationId,
        project_id: projectId,
        assignee_contributor_id: contributorId,
        sprint_id: sprintId,
      })
      .select('external_key', 'summary', 'status', 'issue_type', 'priority', 'labels', 'updated_date');
  }

  // Returns paginated, filterable list of all project issues
  async getProjectIssues(
    organizationId: string,
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
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(100, Math.max(1, filters.perPage ?? 50));
    const offset = (page - 1) * perPage;

    const baseQuery = db('issue_snapshots')
      .where({
        organization_id: organizationId,
        project_id: projectId,
      });

    if (filters.status) {
      baseQuery.where({ status: filters.status });
    }
    if (filters.type) {
      baseQuery.where({ issue_type: filters.type });
    }
    if (filters.priority) {
      baseQuery.where({ priority: filters.priority });
    }
    if (filters.assigneeId) {
      baseQuery.where({ assignee_contributor_id: filters.assigneeId });
    }
    if (filters.sprintId) {
      if (filters.sprintId === 'NULL') {
        baseQuery.whereNull('sprint_id');
      } else {
        baseQuery.where({ sprint_id: filters.sprintId });
      }
    }
    if (filters.q) {
      const search = `%${filters.q}%`;
      baseQuery.where((builder) => {
        builder.where('summary', 'ILike', search)
               .orWhere('external_key', 'ILike', search);
      });
    }

    const totalResult = await baseQuery.clone().count('id as count').first();
    const total = Number(totalResult?.count ?? 0);

    const issues = await baseQuery
      .select(
        'id',
        'external_key as key',
        'summary',
        'status',
        'issue_type as type',
        'priority',
        'assignee_contributor_id as assigneeId',
        'sprint_id as sprintId',
        'updated_date as updatedAt'
      )
      .orderBy('updated_date', 'desc')
      .orderBy('external_key', 'asc')
      .offset(offset)
      .limit(perPage);

    return {
      data: issues,
      meta: {
        total,
        page,
        perPage,
        hasMore: offset + issues.length < total,
      },
    };
  }

  // Compiles feature category total and completion statistics
  async getFeatureBreakdown(
    organizationId: string,
    projectId: string,
    sprintId?: string
  ) {
    const categories = await db('feature_categories')
      .where({
        organization_id: organizationId,
        project_id: projectId,
        deleted_at: null,
      })
      .orderBy('display_order', 'asc')
      .select('id', 'name', 'color');

    const result = [];

    for (const cat of categories) {
      const query = db('issue_snapshots')
        .where({
          organization_id: organizationId,
          project_id: projectId,
          feature_category_id: cat.id,
        });

      if (sprintId) {
        query.where({ sprint_id: sprintId });
      }

      const counts = await query
        .select(
          db.raw('COUNT(*) as total'),
          db.raw(`SUM(CASE WHEN status ILIKE '%done%' OR status ILIKE '%closed%' THEN 1 ELSE 0 END) as done`)
        )
        .first();

      const total = Number(counts?.total ?? 0);
      const done = Number(counts?.done ?? 0);
      const completionRate = total > 0 ? Number((done / total).toFixed(4)) : 0;

      result.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        total,
        done,
        completionRate,
      });
    }

    return result;
  }
}
