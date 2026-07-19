import { useState, useMemo } from 'react';
import type { ContributorMetrics } from '../../api/dashboard.js';
import type { Rating } from '../../api/ratings.js';

interface ContributorTableProps {
  metrics: ContributorMetrics[];
  ratings?: Rating[];
}

type SortKey =
  | 'displayName'
  | 'roleLabel'
  | 'weightedScore'
  | 'deliveryScore'
  | 'volumeScore'
  | 'highPriorityScore'
  | 'issuesTotal'
  | 'issuesDone'
  | 'issuesHighPriority'
  | 'commitCount'
  | 'sprintRank';

interface SortHeaderProps {
  label: string;
  sortKeyValue: SortKey;
  activeSortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}

// Defined at module scope, not inside ContributorTable's render body — a component
// defined per-render gets a new identity every time, which forces React to unmount and
// remount the whole header row on every re-render instead of reusing it.
function SortHeader({ label, sortKeyValue, activeSortKey, sortDirection, onSort }: SortHeaderProps) {
  const isSorted = activeSortKey === sortKeyValue;
  return (
    <th
      scope="col"
      onClick={() => onSort(sortKeyValue)}
      className={[
        'px-6 py-3 cursor-pointer select-none transition-colors hover:bg-gray-100/80',
        isSorted ? 'text-brand-600 bg-brand-50/10 font-bold' : 'font-semibold text-gray-700',
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isSorted && (
          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );
}

export function ContributorTable({ metrics, ratings }: ContributorTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('sprintRank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc'); // Default to descending for numbers
    }
  };

  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => {
      const rawA: string | number | null = a[sortKey];
      const rawB: string | number | null = b[sortKey];

      // Handle nulls
      if (rawA === null) return sortDirection === 'asc' ? 1 : -1;
      if (rawB === null) return sortDirection === 'asc' ? -1 : 1;

      // Handle numeric strings (like weightedScore, deliveryScore, etc.)
      const numA = Number(rawA);
      const numB = Number(rawB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      // Fallback to string comparison
      const strA = String(rawA).toLowerCase();
      const strB = String(rawB).toLowerCase();

      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [metrics, sortKey, sortDirection]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-xs font-semibold uppercase border-b border-gray-200">
            <tr>
              <SortHeader label="Rank" sortKeyValue="sprintRank" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Name" sortKeyValue="displayName" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Role" sortKeyValue="roleLabel" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Score" sortKeyValue="weightedScore" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Delivery (50%)" sortKeyValue="deliveryScore" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Volume (30%)" sortKeyValue="volumeScore" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Priority (20%)" sortKeyValue="highPriorityScore" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Total" sortKeyValue="issuesTotal" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Done" sortKeyValue="issuesDone" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="HP" sortKeyValue="issuesHighPriority" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Commits" sortKeyValue="commitCount" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <th scope="col" className="px-6 py-3 font-semibold text-gray-700">
                Qualitative Ratings
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedMetrics.map((m, index) => {
              const score = m.weightedScore !== null ? Number(m.weightedScore) : null;
              const contributorRatings = ratings?.filter((r) => r.contributorId === m.contributorId) ?? [];

              return (
                <tr key={m.contributorId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {m.sprintRank ?? index + 1}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{m.displayName}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{m.roleLabel ?? '—'}</td>
                  <td
                    className={[
                      'px-6 py-4 font-bold',
                      score === null
                        ? 'text-gray-400'
                        : score >= 70
                        ? 'text-green-600'
                        : score >= 40
                        ? 'text-yellow-600'
                        : 'text-red-600',
                    ].join(' ')}
                  >
                    {score !== null ? score.toFixed(1) : '—'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {m.deliveryScore !== null ? Number(m.deliveryScore).toFixed(0) : '—'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {m.volumeScore !== null ? Number(m.volumeScore).toFixed(0) : '—'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {m.highPriorityScore !== null ? Number(m.highPriorityScore).toFixed(0) : '—'}
                  </td>
                  <td className="px-6 py-4">{m.issuesTotal}</td>
                  <td className="px-6 py-4 text-green-600 font-medium">{m.issuesDone}</td>
                  <td className="px-6 py-4">{m.issuesHighPriority}</td>
                  <td className="px-6 py-4 font-mono font-medium">{m.commitCount}</td>
                  <td className="px-6 py-4">
                    {contributorRatings.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contributorRatings.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700"
                            title={r.notes || undefined}
                          >
                            {r.segmentName}:{' '}
                            <span className="text-brand-600 ml-0.5">
                              {r.scaleType === 'NUMERIC' ? (r.value as number) : String(r.value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">None</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
