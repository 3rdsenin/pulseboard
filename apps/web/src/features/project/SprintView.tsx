import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard.js';
import { ratingsApi } from '../../api/ratings.js';
import { projectsApi } from '../../api/projects.js';
import { syncApi } from '../../api/sync.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ContributorCard } from './ContributorCard.js';
import { ContributorTable } from './ContributorTable.js';
import { IssueTable } from './IssueTable.js';
import { FeatureBreakdownSection } from './FeatureBreakdownSection.js';
import { Button } from '../../components/Button.js';
import { Spinner } from '../../components/Spinner.js';

interface SprintViewProps {
  projectId: string;
  sprintId: string;
  sprintName: string;
}

export function SprintView({ projectId, sprintId, sprintName }: SprintViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const { data: projectMembers } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsApi.listMembers(projectId),
    enabled: !!projectId,
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['sprint-metrics', projectId, sprintId],
    queryFn: () => dashboardApi.getSprintMetrics(projectId, sprintId),
    enabled: !!projectId && !!sprintId,
  });

  const { data: ratings, isLoading: loadingRatings } = useQuery({
    queryKey: ['sprint-ratings', projectId, sprintId],
    queryFn: () => ratingsApi.getSprintRatings(projectId, sprintId),
    enabled: !!projectId && !!sprintId,
  });

  const triggerSync = useMutation({
    // Waits for the sync AND metrics jobs to finish — metrics jobs run on an explicit
    // 60s delay after sync (see workers/scheduler.ts) — instead of guessing a fixed
    // delay before refetching. See api/sync.ts waitForJob.
    mutationFn: async () => {
      const result = await syncApi.triggerSync(projectId);
      const jobIds = [result.jiraSyncJobId, result.githubSyncJobId, ...result.metricsJobIds]
        .filter((id): id is string => !!id);
      await Promise.all(jobIds.map((id) => syncApi.waitForJob(projectId, id)));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-metrics', projectId, sprintId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-ratings', projectId, sprintId] });
    },
  });

  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const member = projectMembers?.find((m) => m.userId === user?.userId);
  const isProjectAdmin = isOrgAdmin || member?.role === 'PROJECT_ADMIN';

  const isLoading = loadingMetrics || loadingRatings;
  const hasMetrics = (metrics?.length ?? 0) > 0 && metrics!.some((m) => m.weightedScore !== null);

  const ratedCount = useMemo(() => {
    if (!ratings) return 0;
    const uniqueRatedIds = new Set(ratings.map((r) => r.contributorId));
    return uniqueRatedIds.size;
  }, [ratings]);

  const totalCount = metrics?.length ?? 0;

  const handleExportMetricsCSV = () => {
    if (!metrics) return;

    // Get unique qualitative segment definitions present in ratings
    const segments = Array.from(
      new Set((ratings ?? []).map((r) => r.segmentName))
    );

    const headers = [
      'Rank',
      'Name',
      'Weighted Score',
      'Jira Issues Done',
      'Jira Issues Total',
      'Commits Count',
      'Repos Touched',
      ...segments,
    ];

    const rows = metrics.map((m, i) => {
      const contributorRatings = ratings?.filter((r) => r.contributorId === m.contributorId) ?? [];

      const segmentScores = segments.map((segName) => {
        const rating = contributorRatings.find((r) => r.segmentName === segName);
        if (!rating) return '—';
        return typeof rating.value === 'object' && rating.value !== null
          ? (rating.value as { score?: unknown }).score ?? JSON.stringify(rating.value)
          : rating.value;
      });

      return [
        m.sprintRank ?? i + 1,
        m.displayName,
        m.weightedScore ?? '—',
        m.issuesDone ?? 0,
        m.issuesTotal ?? 0,
        m.commitCount ?? 0,
        m.reposContributed?.length ?? 0,
        ...segmentScores,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `metrics_export_${sprintName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-base font-semibold text-gray-800">{sprintName}</h3>
          {hasMetrics && (
            <div className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={[
                  'rounded-l-md border px-3 py-1.5 text-xs font-semibold focus:z-10 focus:outline-none focus:ring-1 focus:ring-brand-500',
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
                  'rounded-r-md border border-l-0 px-3 py-1.5 text-xs font-semibold focus:z-10 focus:outline-none focus:ring-1 focus:ring-brand-500',
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
        <div className="flex items-center gap-2">
          {hasMetrics && (
            <span className="text-[11px] text-gray-500 font-semibold bg-gray-150 rounded-full px-2.5 py-1 border border-gray-250">
              Ratings: {ratedCount} / {totalCount} rated
            </span>
          )}
          {hasMetrics && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportMetricsCSV}
            >
              Export Metrics
            </Button>
          )}
          {isProjectAdmin && (
            <>
              <Link to={`/projects/${projectId}/sprints/${sprintId}/ratings`}>
                <Button variant="secondary" size="sm">
                  Enter Ratings
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                loading={triggerSync.isPending}
                onClick={() => triggerSync.mutate()}
              >
                Sync now
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && !hasMetrics && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <p className="text-sm text-gray-500">
            No metrics yet for this sprint.
            {isProjectAdmin
              ? ' Trigger a sync to pull data from Jira and GitHub.'
              : ' Metrics will appear after the next scheduled sync.'}
          </p>
        </div>
      )}

      {!isLoading && hasMetrics && (
        <>
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
        </>
      )}

      {/* Feature categories progress breakdown */}
      {!isLoading && <FeatureBreakdownSection projectId={projectId} sprintId={sprintId} />}

      {/* Sync database issues filter section */}
      {!isLoading && <IssueTable key={sprintId} projectId={projectId} sprintId={sprintId} />}
    </div>
  );
}


