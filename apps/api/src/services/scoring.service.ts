export interface ContributorIssueCounts {
  contributorId: string;
  issuesTotal: number;
  issuesDone: number;
  issuesHighPriority: number;
  issuesInProgress: number;
}

export interface ContributorScore extends ContributorIssueCounts {
  deliveryScore: number;
  volumeScore: number;
  highPriorityScore: number;
  weightedScore: number;
  sprintRank: number;
}

// AOMS reference implementation weighted formula (50/30/20):
//   delivery_score      = (issues_done / issues_total) * 100          — weight 50%
//   volume_score        = issues_done normalised against the team max — weight 30%
//   high_priority_score = (issues_high_priority / issues_total) * 100 — weight 20%
export class ScoringService {
  computeScores(rows: ContributorIssueCounts[]): ContributorScore[] {
    const maxIssuesDone = Math.max(1, ...rows.map((r) => r.issuesDone));

    return rows
      .map((r) => {
        const deliveryScore = r.issuesTotal > 0 ? (r.issuesDone / r.issuesTotal) * 100 : 0;
        const volumeScore = (r.issuesDone / maxIssuesDone) * 100;
        const highPriorityScore = r.issuesTotal > 0 ? (r.issuesHighPriority / r.issuesTotal) * 100 : 0;
        const weightedScore = deliveryScore * 0.5 + volumeScore * 0.3 + highPriorityScore * 0.2;
        return { ...r, deliveryScore, volumeScore, highPriorityScore, weightedScore, sprintRank: 0 };
      })
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .map((s, i) => ({ ...s, sprintRank: i + 1 }));
  }
}
