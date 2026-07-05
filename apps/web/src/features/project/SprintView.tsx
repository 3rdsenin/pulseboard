import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboard.js';
import { syncApi } from '../../api/sync.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ContributorCard } from './ContributorCard.js';
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
  const isAdmin = user?.orgRole === 'ORG_ADMIN';

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['sprint-metrics', projectId, sprintId],
    queryFn: () => dashboardApi.getSprintMetrics(projectId, sprintId),
  });

  const triggerSync = useMutation({
    mutationFn: () => syncApi.triggerSync(projectId),
    onSuccess: () => {
      // Invalidate metrics after a short delay to let the sync job enqueue
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sprint-metrics', projectId, sprintId] });
      }, 3000);
    },
  });

  const hasMetrics = (metrics?.length ?? 0) > 0 && metrics!.some((m) => m.weightedScore !== null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium text-gray-700">{sprintName}</h3>
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
            No metrics yet for this sprint.
            {isAdmin
              ? ' Trigger a sync to pull data from Jira and GitHub.'
              : ' Metrics will appear after the next scheduled sync.'}
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
