import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ratingsApi, type SegmentTemplate } from '../../api/ratings.js';
import { projectsApi } from '../../api/projects.js';
import { useAuth } from '../../hooks/useAuth.js';
import { extractApiError } from '../../api/client.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Spinner } from '../../components/Spinner.js';

export function SegmentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [includeArchived, setIncludeArchived] = useState(false);
  const [editingSegment, setEditingSegment] = useState<SegmentTemplate | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scaleType, setScaleType] = useState<'NUMERIC' | 'ENUM'>('NUMERIC');
  const [scaleMax, setScaleMax] = useState('5');
  const [enumValuesStr, setEnumValuesStr] = useState('Yes, No, Unable to assess');
  const [displayOrder, setDisplayOrder] = useState('0');

  const [error, setError] = useState<string | null>(null);

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

  const { data: segments, isLoading: loadingSegments } = useQuery({
    queryKey: ['segments', projectId, includeArchived],
    queryFn: () => ratingsApi.listSegments(projectId!, includeArchived),
    enabled: !!projectId,
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['segment-templates'],
    queryFn: () => ratingsApi.listTemplates(),
  });

  // Auth checking
  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const member = projectMembers?.find((m) => m.userId === user?.userId);
  const isProjectAdmin = isOrgAdmin || member?.role === 'PROJECT_ADMIN';

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => {
      const enumValues =
        scaleType === 'ENUM'
          ? enumValuesStr
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined;

      return ratingsApi.createSegment(projectId!, {
        name,
        description: description || undefined,
        scaleType,
        scaleMax: scaleType === 'NUMERIC' ? Number(scaleMax) : undefined,
        enumValues,
        displayOrder: Number(displayOrder) || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', projectId] });
      resetForm();
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const importMutation = useMutation({
    mutationFn: (templateId: string) => ratingsApi.createFromTemplate(projectId!, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', projectId] });
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      ratingsApi.updateSegment(projectId!, id, {
        name,
        description,
        displayOrder: Number(displayOrder) || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', projectId] });
      resetForm();
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      ratingsApi.updateSegment(projectId!, id, { isArchived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', projectId] });
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ratingsApi.deleteSegment(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', projectId] });
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const handleEditClick = (s: SegmentTemplate) => {
    setEditingSegment(s);
    setIsAdding(false);
    setName(s.name);
    setDescription(s.description ?? '');
    setScaleType(s.scaleType);
    setScaleMax(String(s.scaleMax ?? '5'));
    setEnumValuesStr(s.enumValues?.join(', ') ?? '');
    setDisplayOrder(String(s.displayOrder ?? '0'));
    setError(null);
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setEditingSegment(null);
    setName('');
    setDescription('');
    setScaleType('NUMERIC');
    setScaleMax('5');
    setEnumValuesStr('Yes, No, Unable to assess');
    setDisplayOrder('0');
    setError(null);
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingSegment(null);
    setName('');
    setDescription('');
    setScaleType('NUMERIC');
    setScaleMax('5');
    setEnumValuesStr('');
    setDisplayOrder('0');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isAdding) {
      createMutation.mutate();
    } else if (editingSegment) {
      updateMutation.mutate(editingSegment.id);
    }
  };

  const orderedSegments = useMemo(() => {
    if (!segments) return [];
    return [...segments].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [segments]);

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedSegments.length) return;

    const current = orderedSegments[index];
    const target = orderedSegments[targetIndex];

    const currentOrder = current.displayOrder ?? 0;
    const targetOrder = target.displayOrder ?? 0;

    // Swap orders using PATCH endpoints
    try {
      await Promise.all([
        ratingsApi.updateSegment(projectId!, current.id, { displayOrder: targetOrder }),
        ratingsApi.updateSegment(projectId!, target.id, { displayOrder: currentOrder }),
      ]);
      queryClient.invalidateQueries({ queryKey: ['segments', projectId] });
    } catch {
      alert('Error swapping segment orders.');
    }
  };

  const isLoading = loadingProject || loadingMembers || loadingSegments || loadingTemplates;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Filter templates that have not been imported to the project yet
  const availableTemplates = templates?.filter(
    (t) => !segments?.some((s) => s.name.toLowerCase() === t.name.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to Project
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-900">{project?.name} — Rating Segments</h1>
          </div>
          {isProjectAdmin && !isAdding && !editingSegment && (
            <Button variant="primary" size="sm" onClick={handleAddClick}>
              Create Segment
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {(isAdding || editingSegment) && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {isAdding ? 'Create Custom Rating Segment' : `Edit Segment: ${editingSegment?.name}`}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Segment Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Collaboration"
              />
              <Input
                label="Display Order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                placeholder="0"
                hint="Segments are displayed in ascending order"
              />
              <div className="sm:col-span-2">
                <Input
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this segment measures"
                />
              </div>

              {/* Immutable fields on edit */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Scale Type</label>
                <select
                  disabled={!!editingSegment}
                  value={scaleType}
                  onChange={(e) => setScaleType(e.target.value as 'NUMERIC' | 'ENUM')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="NUMERIC">Numeric Scale (1 to N)</option>
                  <option value="ENUM">Enum Scale (Custom Labels)</option>
                </select>
              </div>

              {scaleType === 'NUMERIC' ? (
                <Input
                  label="Maximum Value (N)"
                  type="number"
                  disabled={!!editingSegment}
                  value={scaleMax}
                  onChange={(e) => setScaleMax(e.target.value)}
                  placeholder="5"
                  hint="Range will be 1 to this number"
                />
              ) : (
                <Input
                  label="Comma-separated Option Labels"
                  disabled={!!editingSegment}
                  value={enumValuesStr}
                  onChange={(e) => setEnumValuesStr(e.target.value)}
                  placeholder="Yes, No, Unable to assess"
                  hint="List options in display order"
                />
              )}

              <div className="sm:col-span-2 flex items-center justify-end gap-3 mt-4">
                <Button variant="secondary" type="button" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {isAdding ? 'Create Segment' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Templates Sidebar / Grid when adding */}
        {isProjectAdmin && !isAdding && !editingSegment && (availableTemplates?.length ?? 0) > 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-brand-50/20 p-6">
            <h3 className="text-sm font-semibold text-brand-900 mb-1">Import Baseline Segment Templates</h3>
            <p className="text-xs text-brand-700 mb-4">
              Get started quickly by importing baseline segments derived from the AOMS layout.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {availableTemplates?.map((template) => (
                <div
                  key={template.id}
                  className="rounded-md border border-brand-100 bg-white p-4 flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{template.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                    <span className="inline-block mt-2 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                      {template.scaleType === 'NUMERIC'
                        ? `Numeric 1-${template.scaleMax}`
                        : `Enum: ${template.enumValues?.join('/')}`}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800"
                    loading={importMutation.isPending}
                    onClick={() => importMutation.mutate(template.id)}
                  >
                    Import Template
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
            />
            Show archived segments
          </label>
        </div>

        {/* Segments List */}
        {orderedSegments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">
              No rating segments configured. Create a custom segment or import templates above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {orderedSegments.map((s, index) => {
              // Custom badge check if template
              const isTemplateName = templates?.some((t) => t.name === s.name);

              return (
                <div
                  key={s.id}
                  className={[
                    'rounded-lg border bg-white p-6 shadow-sm flex flex-col justify-between transition-all',
                    s.isArchived
                      ? 'border-gray-200 bg-gray-50/50 opacity-70'
                      : 'border-gray-200',
                  ].join(' ')}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                          {s.name}
                          {s.isArchived && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Archived
                            </span>
                          )}
                          {isTemplateName && (
                            <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                              Baseline
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          Display order: {s.displayOrder}
                        </span>
                      </div>

                      {isProjectAdmin && (
                        <div className="flex items-center gap-3">
                          {/* Reordering Controls */}
                          {!includeArchived && (
                            <div className="flex gap-1.5 items-center mr-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMove(index, 'up')}
                                className="text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer text-xs"
                                title="Move Up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === orderedSegments.length - 1}
                                onClick={() => handleMove(index, 'down')}
                                className="text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer text-xs"
                                title="Move Down"
                              >
                                ▼
                              </button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditClick(s)}
                              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() =>
                                toggleArchiveMutation.mutate({
                                  id: s.id,
                                  isArchived: !s.isArchived,
                                })
                              }
                              className="text-xs font-semibold text-gray-600 hover:text-gray-700"
                            >
                              {s.isArchived ? 'Restore' : 'Archive'}
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to permanently delete segment ${s.name}? This will delete all associated qualitative ratings.`
                                  )
                                ) {
                                  deleteMutation.mutate(s.id);
                                }
                              }}
                              className="text-xs font-semibold text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {s.description && <p className="text-xs text-gray-500 mt-3">{s.description}</p>}
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">Scale Config</span>
                    <span className="text-xs font-bold text-brand-600">
                      {s.scaleType === 'NUMERIC'
                        ? `Numeric 1-${s.scaleMax}`
                        : `Enum: ${s.enumValues?.join(', ')}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
