import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard.js';
import { syncApi } from '../../api/sync.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ContributorCard } from './ContributorCard.js';
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

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['project-overview', projectId],
    queryFn: () => dashboardApi.getProjectOverview(projectId),
  });

  const triggerSync = useMutation({
    mutationFn: () => syncApi.triggerSync(projectId),
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['project-overview', projectId] });
      }, 3000);
    },
  });

  const hasMetrics = (metrics?.length ?? 0) > 0 && metrics!.some((m) => (m.issuesTotal ?? 0) > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium text-gray-700">All Issues</h3>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {metrics!.map((m, i) => (
            <ContributorCard key={m.contributorId} metrics={m} rank={m.sprintRank ?? i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
