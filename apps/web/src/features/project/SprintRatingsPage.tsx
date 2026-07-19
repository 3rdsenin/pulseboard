import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ratingsApi } from '../../api/ratings.js';
import { contributorsApi } from '../../api/contributors.js';
import { projectsApi } from '../../api/projects.js';
import { dashboardApi } from '../../api/dashboard.js';
import { useAuth } from '../../hooks/useAuth.js';
import { extractApiError } from '../../api/client.js';
import { Button } from '../../components/Button.js';
import { Spinner } from '../../components/Spinner.js';

interface CellState {
  value: number | string | null;
  notes: string;
  isDirty: boolean;
}

export function SprintRatingsPage() {
  const { projectId, sprintId } = useParams<{ projectId: string; sprintId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState<Record<string, CellState>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Queries
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: projectMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsApi.listMembers(projectId!),
    enabled: !!projectId,
  });

  const { data: sprints, isLoading: loadingSprints } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => dashboardApi.listSprints(projectId!),
    enabled: !!projectId,
  });

  const { data: segments, isLoading: loadingSegments } = useQuery({
    queryKey: ['segments', projectId],
    queryFn: () => ratingsApi.listSegments(projectId!),
    enabled: !!projectId,
  });

  const { data: contributors, isLoading: loadingContributors } = useQuery({
    queryKey: ['contributors', projectId],
    queryFn: () => contributorsApi.list(projectId!, false), // active only
    enabled: !!projectId,
  });

  const { data: ratings, isLoading: loadingRatings } = useQuery({
    queryKey: ['sprint-ratings', projectId, sprintId],
    queryFn: () => ratingsApi.getSprintRatings(projectId!, sprintId!),
    enabled: !!projectId && !!sprintId,
  });

  const activeSprint = sprints?.find((s) => s.id === sprintId);
  const sprintName = activeSprint?.name ?? 'Sprint';

  // Auth checking
  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const projectMember = projectMembers?.find((m) => m.userId === user?.userId);
  const isProjectAdmin = isOrgAdmin || projectMember?.role === 'PROJECT_ADMIN';

  // Initialize form state when contributors, segments, and ratings are loaded
  useEffect(() => {
    if (!contributors || !segments) return;

    const initialForm: Record<string, CellState> = {};
    contributors.forEach((contributor) => {
      segments.forEach((segment) => {
        const key = `${contributor.id}_${segment.id}`;
        // Find existing rating if any
        const existingRating = ratings?.find(
          (r) => r.contributorId === contributor.id && r.segmentDefinitionId === segment.id
        );

        initialForm[key] = {
          value: existingRating ? (existingRating.value as number | string) : null,
          notes: existingRating?.notes ?? '',
          isDirty: false,
        };
      });
    });

    // This effect derives locally-editable draft state from three async queries
    // (contributors/segments/ratings) — a legitimate re-initialize-on-source-change case
    // the newer set-state-in-effect rule doesn't have a clean non-effect equivalent for,
    // since the draft must stay independently editable between saves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormState(initialForm);
    setSaveSuccess(false);
    setSaveError(null);
  }, [contributors, segments, ratings]);

  const handleValueChange = (contributorId: string, segmentId: string, value: number | string | null) => {
    if (!isProjectAdmin) return;
    const key = `${contributorId}_${segmentId}`;
    setFormState((prev) => {
      const existingRating = ratings?.find(
        (r) => r.contributorId === contributorId && r.segmentDefinitionId === segmentId
      );
      // Clean up stringified value if any
      const originalValue = existingRating ? existingRating.value : null;
      const isDirty = originalValue !== value;

      return {
        ...prev,
        [key]: {
          ...prev[key],
          value,
          isDirty,
        },
      };
    });
  };

  const handleNotesChange = (contributorId: string, segmentId: string, notes: string) => {
    if (!isProjectAdmin) return;
    const key = `${contributorId}_${segmentId}`;
    setFormState((prev) => {
      const existingRating = ratings?.find(
        (r) => r.contributorId === contributorId && r.segmentDefinitionId === segmentId
      );
      const originalNotes = existingRating?.notes ?? '';
      const isDirty = originalNotes !== notes;

      return {
        ...prev,
        [key]: {
          ...prev[key],
          notes,
          isDirty,
        },
      };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<unknown>[] = [];
      Object.entries(formState).forEach(([key, state]) => {
        if (!state.isDirty) return;

        const [contributorId, segmentId] = key.split('_');
        if (state.value === null || state.value === undefined) {
          // If rating value is cleared, delete it
          promises.push(
            ratingsApi.deleteRating(projectId!, sprintId!, contributorId!, segmentId!)
          );
        } else {
          promises.push(
            ratingsApi.upsertRating(
              projectId!,
              sprintId!,
              contributorId!,
              segmentId!,
              state.value,
              state.notes || undefined
            )
          );
        }
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-ratings', projectId, sprintId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-metrics', projectId, sprintId] });
      setSaveSuccess(true);
      setSaveError(null);
    },
    onError: async (err) => {
      setSaveError(await extractApiError(err));
    },
  });

  const isFormDirty = Object.values(formState).some((state) => state.isDirty);
  const isLoading =
    loadingProject ||
    loadingMembers ||
    loadingSegments ||
    loadingContributors ||
    loadingRatings ||
    loadingSprints;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const hasContributors = (contributors?.length ?? 0) > 0;
  const hasSegments = (segments?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${projectId}`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Project
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-900">
              {project?.name} — {sprintName} Ratings
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/projects/${projectId}`)}
            >
              Cancel
            </Button>
            {isProjectAdmin && (
              <Button
                variant="primary"
                size="sm"
                disabled={!isFormDirty || saveMutation.isPending}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save Ratings
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {!isProjectAdmin && (
          <div className="mb-6 rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 border border-yellow-200">
            <strong>Read-only view:</strong> You need to be a Project Admin or Organisation Admin to enter or modify ratings.
          </div>
        )}

        {saveSuccess && (
          <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200">
            Ratings saved successfully!
          </div>
        )}

        {saveError && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            <strong>Error saving ratings:</strong> {saveError}
          </div>
        )}

        {!hasContributors ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">
              No contributors configured for this project. Please add contributors in project settings first.
            </p>
          </div>
        ) : !hasSegments ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">
              No rating segments configured for this project. Please add segments in project settings first.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-gray-500">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 w-64 border-r border-gray-200">
                      Contributor
                    </th>
                    {segments!.map((segment) => (
                      <th
                        key={segment.id}
                        scope="col"
                        className="px-6 py-3 min-w-[280px] border-r border-gray-200 last:border-r-0"
                      >
                        <div>
                          <span className="font-semibold text-gray-900 block">{segment.name}</span>
                          {segment.description && (
                            <span className="text-[10px] text-gray-400 normal-case font-normal block mt-0.5">
                              {segment.description}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {contributors!.map((contributor) => {
                    const rowHasDirty = segments!.some((segment) => {
                      const key = `${contributor.id}_${segment.id}`;
                      return formState[key]?.isDirty;
                    });

                    return (
                      <tr
                        key={contributor.id}
                        className={[
                          'hover:bg-gray-50/50 transition-colors',
                          rowHasDirty ? 'bg-brand-50/10' : '',
                        ].join(' ')}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-semibold text-gray-900">{contributor.display_name}</div>
                              {contributor.role_label && (
                                <div className="text-xs text-gray-500 mt-0.5">{contributor.role_label}</div>
                              )}
                            </div>
                            {rowHasDirty && (
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" title="Unsaved changes" />
                            )}
                          </div>
                        </td>

                        {segments!.map((segment) => {
                          const key = `${contributor.id}_${segment.id}`;
                          const cell = formState[key] || { value: null, notes: '', isDirty: false };

                          return (
                            <td
                              key={segment.id}
                              className="px-6 py-4 border-r border-gray-200 last:border-r-0 align-top"
                            >
                              <div className="flex flex-col gap-3">
                                {/* Rating Input */}
                                <div>
                                  {segment.scaleType === 'NUMERIC' ? (
                                    <div className="flex items-center gap-1.5">
                                      {Array.from({ length: segment.scaleMax ?? 5 }).map((_, i) => {
                                        const scoreValue = i + 1;
                                        const isSelected = cell.value === scoreValue;
                                        return (
                                          <button
                                            key={scoreValue}
                                            type="button"
                                            disabled={!isProjectAdmin}
                                            onClick={() =>
                                              handleValueChange(
                                                contributor.id,
                                                segment.id,
                                                isSelected ? null : scoreValue
                                              )
                                            }
                                            className={[
                                              'h-8 w-8 rounded-full border text-xs font-semibold flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500',
                                              isSelected
                                                ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                                              !isProjectAdmin ? 'opacity-70 cursor-not-allowed' : '',
                                            ].join(' ')}
                                          >
                                            {scoreValue}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <select
                                      disabled={!isProjectAdmin}
                                      value={cell.value ?? ''}
                                      onChange={(e) =>
                                        handleValueChange(
                                          contributor.id,
                                          segment.id,
                                          e.target.value === '' ? null : e.target.value
                                        )
                                      }
                                      className={[
                                        'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
                                        !isProjectAdmin ? 'opacity-70 cursor-not-allowed bg-gray-50' : '',
                                      ].join(' ')}
                                    >
                                      <option value="">— Select rating —</option>
                                      {segment.enumValues?.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                {/* Notes Input */}
                                <div>
                                  <textarea
                                    disabled={!isProjectAdmin}
                                    placeholder="Add notes/comments (optional)..."
                                    value={cell.notes}
                                    onChange={(e) =>
                                      handleNotesChange(contributor.id, segment.id, e.target.value)
                                    }
                                    rows={2}
                                    className={[
                                      'w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none shadow-inner',
                                      !isProjectAdmin ? 'opacity-70 cursor-not-allowed bg-gray-50' : '',
                                    ].join(' ')}
                                  />
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
