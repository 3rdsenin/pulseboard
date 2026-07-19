import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects.js';
import { dashboardApi } from '../../api/dashboard.js';
import { syncApi } from '../../api/sync.js';
import { extractApiError } from '../../api/client.js';
import { useAuth } from '../../hooks/useAuth.js';
import { SprintView } from './SprintView.js';
import { ProjectOverview } from './ProjectOverview.js';
import { ShareModal } from './ShareModal.js';
import { Button } from '../../components/Button.js';
import { Spinner } from '../../components/Spinner.js';

const OVERVIEW = 'overview' as const;

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.orgRole === 'ORG_ADMIN';
  // null = not yet chosen — defaults to the active/most recent sprint if one exists,
  // otherwise the always-available All Issues overview (see displayView below).
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const triggerSync = useMutation({
    // Waits for the Jira sync job to actually finish (it writes the sprints table)
    // instead of guessing a fixed delay before refetching. See api/sync.ts waitForJob.
    mutationFn: async () => {
      const result = await syncApi.triggerSync(projectId!);
      if (result.jiraSyncJobId) await syncApi.waitForJob(projectId!, result.jiraSyncJobId);
      return result;
    },
    onSuccess: () => {
      setSyncError(null);
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
    onError: async (error) => setSyncError(await extractApiError(error)),
  });

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: projectMembers } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsApi.listMembers(projectId!),
    enabled: !!projectId,
  });

  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const member = projectMembers?.find((m) => m.userId === user?.userId);
  const isProjectAdmin = isOrgAdmin || member?.role === 'PROJECT_ADMIN';

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

  // Auto-select the active/most recent sprint when sprints exist; otherwise default to
  // the All Issues overview — a project is never blocked from showing data by sprint state.
  const activeSprint = sprints?.[0];
  const displayView = selectedView ?? activeSprint?.id ?? OVERVIEW;

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
              <>
                <Link
                  to={`/projects/${projectId}/contributors`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Contributors
                </Link>
                <Link
                  to={`/projects/${projectId}/segments`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Segments
                </Link>
                <Link
                  to={`/projects/${projectId}/feature-categories`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Features
                </Link>
                <Link
                  to={`/projects/${projectId}/integrations`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Integrations
                </Link>
                {isProjectAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsShareOpen(true)}
                    className="text-sm font-medium text-brand-600 hover:underline cursor-pointer"
                  >
                    Share
                  </button>
                )}
                {isProjectAdmin && (
                  <Link
                    to={`/projects/${projectId}/settings`}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    Settings
                  </Link>
                )}
              </>
            )}
            <Link to="/settings/profile" className="text-sm font-medium text-brand-600 hover:underline">
              My Profile
            </Link>
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* View tabs — All Issues is always available; per-sprint tabs are an additive
            lens on top, shown only once sprint data exists. A project with zero sprints
            (e.g. a Kanban board) is fully viewable via All Issues alone. */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-0">
          <button
            onClick={() => setSelectedView(OVERVIEW)}
            className={[
              'rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition-colors',
              displayView === OVERVIEW
                ? 'border-gray-200 bg-white text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            All Issues
          </button>

          {loadingSprints &&
            [1, 2].map((i) => (
              <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-gray-200" />
            ))}

          {!loadingSprints &&
            sprints?.map((sprint) => {
              const isSelected = displayView === sprint.id;
              return (
                <button
                  key={sprint.id}
                  onClick={() => setSelectedView(sprint.id)}
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

        {!loadingSprints && (sprints?.length ?? 0) === 0 && (
          <p className="mb-6 text-sm text-gray-500">
            No sprints found.{' '}
            {isAdmin ? (
              <>
                Connect a Jira or GitHub integration{' '}
                <Link to={`/projects/${projectId}/integrations`} className="font-medium text-brand-600 hover:underline">
                  here
                </Link>
                {' '}if you haven&apos;t, or{' '}
                <button
                  onClick={() => triggerSync.mutate()}
                  disabled={!isAdmin}
                  className="font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  sync now
                </button>
                . Boards without sprints (e.g. Kanban) will never show any — that&apos;s expected, use All Issues below.
              </>
            ) : (
              'An admin needs to connect an integration and run a sync.'
            )}
            {syncError && <span className="mt-1 block text-red-600">{syncError}</span>}
          </p>
        )}

        {/* View content */}
        {projectId && displayView === OVERVIEW && <ProjectOverview projectId={projectId} />}
        {projectId && displayView !== OVERVIEW && (
          <SprintView
            projectId={projectId}
            sprintId={displayView}
            sprintName={sprints?.find((s) => s.id === displayView)?.name ?? ''}
          />
        )}
      </main>

      {projectId && (
        <ShareModal
          projectId={projectId}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
}
