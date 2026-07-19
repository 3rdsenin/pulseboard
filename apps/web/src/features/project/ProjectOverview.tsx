import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard.js';
import { syncApi } from '../../api/sync.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ContributorCard } from './ContributorCard.js';
import { ContributorTable } from './ContributorTable.js';
import { IssueTable } from './IssueTable.js';
import { FeatureBreakdownSection } from './FeatureBreakdownSection.js';
import { Button } from '../../components/Button.js';
import { Spinner } from '../../components/Spinner.js';

interface ProjectOverviewProps {
  projectId: string;
}

// Contributor stats across ALL synced issues, independent of sprints — the default,
// always-available view. Sprints (SprintView) are an additive lens on top of this, not
// a requirement — a project with zero sprints (e.g. a Kanban board) is fully usable here.
export function ProjectOverview({ projectId }: ProjectOverviewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.orgRole === 'ORG_ADMIN';
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['project-overview', projectId],
    queryFn: () => dashboardApi.getProjectOverview(projectId),
  });

  const triggerSync = useMutation({
    // Waits for the actual sync jobs to finish (a real sync can take tens of seconds)
    // instead of guessing a fixed delay before refetching — see api/sync.ts waitForJob.
    mutationFn: async () => {
      const result = await syncApi.triggerSync(projectId);
      const jobIds = [result.jiraSyncJobId, result.githubSyncJobId].filter((id): id is string => !!id);
      await Promise.all(jobIds.map((id) => syncApi.waitForJob(projectId, id)));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-overview', projectId] });
    },
  });

  const hasMetrics = (metrics?.length ?? 0) > 0 && metrics!.some((m) => (m.issuesTotal ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-base font-semibold text-gray-800">All Issues Overview</h3>
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
        {isAdmin && (
          <Button
            variant="secondary"
            size="sm"
            loading={triggerSync.isPending}
            onClick={() => triggerSync.mutate()}
          >
            Sync now
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && !hasMetrics && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <p className="text-sm text-gray-500">
            No data yet.{' '}
            {isAdmin ? (
              <>
                Connect a Jira or GitHub integration{' '}
                <Link to={`/projects/${projectId}/integrations`} className="font-medium text-brand-600 hover:underline">
                  here
                </Link>
                , then sync.
              </>
            ) : (
              'An admin needs to connect an integration and run a sync.'
            )}
          </p>
        </div>
      )}

      {!isLoading && hasMetrics && (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {metrics!.map((m, i) => (
                <ContributorCard key={m.contributorId} metrics={m} rank={m.sprintRank ?? i + 1} />
              ))}
            </div>
          ) : (
            <ContributorTable metrics={metrics!} />
          )}
        </>
      )}

      {/* Feature categories progress breakdown */}
      {!isLoading && <FeatureBreakdownSection projectId={projectId} />}

      {/* Sync database issues filter section */}
      {!isLoading && <IssueTable projectId={projectId} />}
    </div>
  );
}

