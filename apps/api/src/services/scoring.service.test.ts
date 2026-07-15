import { describe, it, expect } from 'vitest';
import { ScoringService } from './scoring.service.js';

describe('ScoringService', () => {
  const service = new ScoringService();

  it('computes delivery, volume, and high-priority scores per the 50/30/20 weighted formula', () => {
    const [result] = service.computeScores([
      { contributorId: 'a', issuesTotal: 10, issuesDone: 8, issuesHighPriority: 4, issuesInProgress: 1 },
    ]);

    // delivery = (8/10)*100 = 80; volume = (8/8)*100 = 100 (sole contributor is the team max);
    // highPriority = (4/10)*100 = 40
    // weighted = 80*0.5 + 100*0.3 + 40*0.2 = 40 + 30 + 8 = 78
    expect(result.deliveryScore).toBeCloseTo(80);
    expect(result.volumeScore).toBeCloseTo(100);
    expect(result.highPriorityScore).toBeCloseTo(40);
    expect(result.weightedScore).toBeCloseTo(78);
  });

  it('normalises volume score against the team maximum, not a fixed scale', () => {
    const results = service.computeScores([
      { contributorId: 'a', issuesTotal: 10, issuesDone: 10, issuesHighPriority: 0, issuesInProgress: 0 },
      { contributorId: 'b', issuesTotal: 10, issuesDone: 5, issuesHighPriority: 0, issuesInProgress: 0 },
    ]);

    const a = results.find((r) => r.contributorId === 'a')!;
    const b = results.find((r) => r.contributorId === 'b')!;

    expect(a.volumeScore).toBeCloseTo(100); // team max
    expect(b.volumeScore).toBeCloseTo(50); // half of team max
  });

  it('avoids division by zero when a contributor has no issues', () => {
    const [result] = service.computeScores([
      { contributorId: 'a', issuesTotal: 0, issuesDone: 0, issuesHighPriority: 0, issuesInProgress: 0 },
    ]);

    expect(result.deliveryScore).toBe(0);
    expect(result.highPriorityScore).toBe(0);
    expect(result.volumeScore).toBe(0);
    expect(result.weightedScore).toBe(0);
    expect(Number.isNaN(result.weightedScore)).toBe(false);
  });

  it('ranks contributors by weighted score, highest first', () => {
    const results = service.computeScores([
      { contributorId: 'low', issuesTotal: 10, issuesDone: 1, issuesHighPriority: 0, issuesInProgress: 0 },
      { contributorId: 'high', issuesTotal: 10, issuesDone: 10, issuesHighPriority: 5, issuesInProgress: 0 },
      { contributorId: 'mid', issuesTotal: 10, issuesDone: 5, issuesHighPriority: 2, issuesInProgress: 0 },
    ]);

    expect(results.map((r) => r.contributorId)).toEqual(['high', 'mid', 'low']);
    expect(results.map((r) => r.sprintRank)).toEqual([1, 2, 3]);
  });

  it('returns an empty array for an empty sprint roster', () => {
    expect(service.computeScores([])).toEqual([]);
  });
});
