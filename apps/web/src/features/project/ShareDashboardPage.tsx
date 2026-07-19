import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shareApi } from '../../api/share.js';
import { ContributorCard } from './ContributorCard.js';
import { ContributorTable } from './ContributorTable.js';
import { FeatureBreakdownSection } from './FeatureBreakdownSection.js';
import { IssueTable } from './IssueTable.js';
import { Spinner } from '../../components/Spinner.js';

const OVERVIEW = 'overview' as const;

export function ShareDashboardPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // 1. Fetch metadata
  const { data: meta, isLoading: loadingMeta, isError } = useQuery({
    queryKey: ['share-meta', shareToken],
    queryFn: () => shareApi.getMetadata(shareToken!),
    enabled: !!shareToken,
    retry: false,
  });

  // 2. Fetch sprints list
  const { data: sprints, isLoading: loadingSprints } = useQuery({
    queryKey: ['share-sprints', shareToken],
    queryFn: () => shareApi.listSprints(shareToken!),
    enabled: !!shareToken && !!meta,
  });

  // Order sprints
  const orderedSprints = useMemo(() => {
    if (!sprints) return [];
    return [...sprints].sort((a, b) => {
      if (a.state === 'ACTIVE') return -1;
      if (b.state === 'ACTIVE') return 1;
      return (b.startDate ?? '').localeCompare(a.startDate ?? '');
    });
  }, [sprints]);

  const activeSprint = orderedSprints?.[0];
  const displayView = selectedView ?? activeSprint?.id ?? OVERVIEW;

  // 3. Fetch Metrics & Ratings based on selected view
  const isOverview = displayView === OVERVIEW;
  const sprintId = isOverview ? undefined : displayView;

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['share-metrics', shareToken, displayView],
    queryFn: () =>
      isOverview
        ? shareApi.getProjectOverview(shareToken!)
        : shareApi.getSprintMetrics(shareToken!, sprintId!),
    enabled: !!shareToken && !!meta && (!isOverview ? !!sprintId : true),
  });

  const { data: ratings, isLoading: loadingRatings } = useQuery({
    queryKey: ['share-ratings', shareToken, sprintId],
    queryFn: () => shareApi.getSprintRatings(shareToken!, sprintId!),
    enabled: !!shareToken && !!meta && !isOverview && !!sprintId,
  });

  const isLoading = loadingMeta || loadingSprints || loadingMetrics || loadingRatings;
  const hasMetrics = (metrics?.length ?? 0) > 0 && metrics!.some((m) => m.weightedScore !== null || (m.issuesTotal ?? 0) > 0);

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full rounded-lg border border-red-200 bg-white p-6 shadow-sm text-center">
          <h2 className="text-sm font-semibold text-red-600 mb-2">Access Denied / Invalid Link</h2>
          <p className="text-xs text-gray-500">
            This shareable dashboard link is invalid, expired, or requires you to be logged in with a member account.
          </p>
        </div>
      </div>
    );
  }

  if (loadingMeta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header (Branding only) */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-brand-600 tracking-tight">PulseBoard</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shared Dashboard</span>
          </div>
          <h1 className="text-sm font-bold text-gray-800">{meta?.projectName ?? '…'}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        {/* Sprint / View Selector Tabs */}
        {orderedSprints && orderedSprints.length > 0 && (
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
              {orderedSprints.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedView(s.id)}
                  className={[
                    'whitespace-nowrap border-b-2 py-4 px-1 text-xs font-semibold focus:outline-none transition-colors',
                    displayView === s.id
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                  ].join(' ')}
                >
                  {s.name}
                  {s.state === 'ACTIVE' && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 border border-green-200/50">
                      Active
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setSelectedView(OVERVIEW)}
                className={[
                  'whitespace-nowrap border-b-2 py-4 px-1 text-xs font-semibold focus:outline-none transition-colors',
                  displayView === OVERVIEW
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                ].join(' ')}
              >
                All Issues
              </button>
            </nav>
          </div>
        )}

        {/* View Section Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-gray-800">
              {isOverview ? 'All Issues Overview' : orderedSprints.find((s) => s.id === displayView)?.name}
            </h2>
            {hasMetrics && (
              <div className="inline-flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={[
                    'rounded-l-md border px-3 py-1.5 text-xs font-semibold focus:z-10 focus:outline-none',
                    viewMode === 'grid'
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={[
                    'rounded-r-md border border-l-0 px-3 py-1.5 text-xs font-semibold focus:z-10 focus:outline-none',
                    viewMode === 'table'
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  Table
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : !hasMetrics ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16 text-center text-xs text-gray-500">
            No dashboard metrics generated yet for this view.
          </div>
        ) : (
          <div className="space-y-6">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {metrics!.map((m, i) => (
                  <ContributorCard
                    key={m.contributorId}
                    metrics={m}
                    rank={m.sprintRank ?? i + 1}
                    ratings={ratings?.filter((r) => r.contributorId === m.contributorId)}
                  />
                ))}
              </div>
            ) : (
              <ContributorTable metrics={metrics!} ratings={ratings} />
            )}

            {/* Feature categories breakdown */}
            <FeatureBreakdownSection shareToken={shareToken} sprintId={sprintId} />

            {/* Issues search database filter */}
            <IssueTable shareToken={shareToken} sprintId={sprintId} />
          </div>
        )}
      </main>
    </div>
  );
}
