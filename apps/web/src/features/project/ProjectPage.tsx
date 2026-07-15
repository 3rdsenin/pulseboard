import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects.js';
import { dashboardApi } from '../../api/dashboard.js';
import { syncApi } from '../../api/sync.js';
import { extractApiError } from '../../api/client.js';
import { useAuth } from '../../hooks/useAuth.js';
import { SprintView } from './SprintView.js';
import { Button } from '../../components/Button.js';
import { Spinner } from '../../components/Spinner.js';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.orgRole === 'ORG_ADMIN';
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const triggerSync = useMutation({
    mutationFn: () => syncApi.triggerSync(projectId!),
    onSuccess: () => {
      setSyncError(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      }, 3000);
    },
    onError: async (error) => setSyncError(await extractApiError(error)),
  });

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: sprints, isLoading: loadingSprints } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => dashboardApi.listSprints(projectId!),
    enabled: !!projectId,
    select: (data) => {
      // Active sprint first, then closed by start_date desc
      return [...data].sort((a, b) => {
        if (a.state === 'ACTIVE') return -1;
        if (b.state === 'ACTIVE') return 1;
        return (b.startDate ?? '').localeCompare(a.startDate ?? '');
      });
    },
  });

  // Auto-select the first sprint (active or most recent) when sprints load
  const activeSprint = sprints?.[0];
  const displaySprintId = selectedSprintId ?? activeSprint?.id ?? null;

  if (loadingProject) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              ← Projects
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-900">{project?.name ?? '…'}</h1>
          </div>
          <div className="flex items-center gap-4">
            {projectId && (
              <Link
                to={`/projects/${projectId}/integrations`}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                Integrations
              </Link>
            )}
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Sprint tabs */}
        {loadingSprints && (
          <div className="mb-6 flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-gray-200" />
            ))}
          </div>
        )}

        {!loadingSprints && (sprints?.length ?? 0) === 0 && (
          <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-10 text-center">
            <p className="text-sm text-gray-500">
              No sprints found yet.{' '}
              {isAdmin ? (
                <>
                  Make sure a Jira or GitHub integration is{' '}
                  <Link to={`/projects/${projectId}/integrations`} className="font-medium text-brand-600 hover:underline">
                    connected
                  </Link>
                  , then trigger a sync.
                </>
              ) : (
                'An admin needs to connect an integration and run a sync.'
              )}
            </p>
            {isAdmin && (
              <div className="mt-4">
                <Button size="sm" loading={triggerSync.isPending} onClick={() => triggerSync.mutate()}>
                  Sync now
                </Button>
                {syncError && <p className="mt-2 text-sm text-red-600">{syncError}</p>}
              </div>
            )}
          </div>
        )}

        {!loadingSprints && (sprints?.length ?? 0) > 0 && (
          <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-0">
            {sprints!.map((sprint) => {
              const isSelected = (selectedSprintId ?? activeSprint?.id) === sprint.id;
              return (
                <button
                  key={sprint.id}
                  onClick={() => setSelectedSprintId(sprint.id)}
                  className={[
                    'rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition-colors',
                    isSelected
                      ? 'border-gray-200 bg-white text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {sprint.name}
                  {sprint.state === 'ACTIVE' && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Sprint content */}
        {displaySprintId && projectId && (
          <SprintView
            projectId={projectId}
            sprintId={displaySprintId}
            sprintName={sprints?.find((s) => s.id === displaySprintId)?.name ?? ''}
          />
        )}
      </main>
    </div>
  );
}
