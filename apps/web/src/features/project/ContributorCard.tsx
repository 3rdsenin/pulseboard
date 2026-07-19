import type { Rating } from '../../api/ratings.js';
import type { ContributorMetrics } from '../../api/dashboard.js';

interface ContributorCardProps {
  metrics: ContributorMetrics;
  rank: number;
  ratings?: Rating[];
}

// Converts a 0–100 score into a colour class so high scores are green and low scores are red
function scoreColour(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value !== null ? Math.min(100, Math.max(0, Number(value))) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{value !== null ? `${Number(value).toFixed(0)}` : '—'}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ContributorCard({ metrics, rank, ratings }: ContributorCardProps) {
  const weighted = metrics.weightedScore !== null ? Number(metrics.weightedScore) : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between h-full">
      <div>
        {/* Header row: rank badge + name + role */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
              {rank}
            </span>
            <div>
              <p className="font-medium text-gray-900">{metrics.displayName}</p>
              {metrics.roleLabel && (
                <p className="text-xs text-gray-500">{metrics.roleLabel}</p>
              )}
            </div>
          </div>

          {/* Weighted score — the primary signal */}
          <div className="text-right flex-shrink-0">
            <p className={`text-xl font-bold ${scoreColour(weighted)}`}>
              {weighted !== null ? weighted.toFixed(1) : '—'}
            </p>
            <p className="text-xs text-gray-400">score</p>
          </div>
        </div>

        {/* Score breakdown bars */}
        <div className="mb-4 flex flex-col gap-2">
          <ScoreBar label="Delivery (50%)" value={metrics.deliveryScore !== null ? Number(metrics.deliveryScore) : null} />
          <ScoreBar label="Volume (30%)" value={metrics.volumeScore !== null ? Number(metrics.volumeScore) : null} />
          <ScoreBar label="Priority (20%)" value={metrics.highPriorityScore !== null ? Number(metrics.highPriorityScore) : null} />
        </div>

        {/* Issue + commit stats */}
        <div className="grid grid-cols-4 gap-2 border-t border-gray-100 py-3">
          {[
            { label: 'Total', value: metrics.issuesTotal },
            { label: 'Done', value: metrics.issuesDone },
            { label: 'HP', value: metrics.issuesHighPriority },
            { label: 'Commits', value: metrics.commitCount },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-semibold text-gray-800">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Qualitative Ratings Section */}
      {ratings && ratings.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Qualitative Ratings</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ratings.map((rating) => (
              <div
                key={rating.id}
                className="rounded bg-gray-50/50 p-1.5 border border-gray-100 flex flex-col justify-between min-h-[46px]"
                title={rating.notes || undefined}
              >
                <div className="text-[9px] text-gray-500 font-medium truncate" title={rating.segmentName}>
                  {rating.segmentName}
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-xs font-bold text-brand-600">
                    {rating.scaleType === 'NUMERIC' ? (rating.value as number) : String(rating.value)}
                  </span>
                  {rating.scaleType === 'NUMERIC' && (
                    <span className="text-[8px] text-gray-400">/{rating.scaleMax}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

