import db from '../db/index.js';

export class DashboardService {
  async listSprints(organizationId: string, projectId: string) {
    return db('sprints')
      .where({ organization_id: organizationId, project_id: projectId })
      .orderBy('start_date', 'desc')
      .select('id', 'name', 'state', 'start_date', 'end_date', 'complete_date', 'goal', 'synced_at');
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
}
