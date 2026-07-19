import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { featureCategoriesApi, type FeatureCategory } from '../../api/feature-categories.js';
import { projectsApi } from '../../api/projects.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Spinner } from '../../components/Spinner.js';

const PRESET_COLORS = [
  { name: 'Sky Blue', hex: '#38BDF8' },
  { name: 'Emerald', hex: '#34D399' },
  { name: 'Purple', hex: '#A78BFA' },
  { name: 'Orange', hex: '#FB923C' },
  { name: 'Pink', hex: '#F472B6' },
  { name: 'Yellow', hex: '#FACC15' },
  { name: 'Slate', hex: '#94A3B8' },
];

export function FeatureCategoriesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [matchPatterns, setMatchPatterns] = useState('');
  const [color, setColor] = useState('#38BDF8');

  // Queries
  const { data: projectMembers } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsApi.listMembers(projectId!),
    enabled: !!projectId,
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['feature-categories', projectId],
    queryFn: () => featureCategoriesApi.list(projectId!),
    enabled: !!projectId,
  });

  // Access check
  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const member = projectMembers?.find((m) => m.userId === user?.userId);
  const isProjectAdmin = isOrgAdmin || member?.role === 'PROJECT_ADMIN';

  // Mutations
  const createMutation = useMutation({
    mutationFn: (input: { name: string; matchPatterns: string[]; color?: string }) =>
      featureCategoriesApi.create(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-categories', projectId] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; matchPatterns?: string[]; color?: string } }) =>
      featureCategoriesApi.update(projectId!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-categories', projectId] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => featureCategoriesApi.delete(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-categories', projectId] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (order: string[]) => featureCategoriesApi.reorder(projectId!, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-categories', projectId] });
    },
  });

  const resetForm = () => {
    setIsEditing(null);
    setName('');
    setMatchPatterns('');
    setColor('#38BDF8');
  };

  const handleEditClick = (cat: FeatureCategory) => {
    setIsEditing(cat.id);
    setName(cat.name);
    setMatchPatterns(cat.matchPatterns.join(', '));
    setColor(cat.color || '#38BDF8');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProjectAdmin) return;

    const patterns = matchPatterns
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (patterns.length === 0) {
      alert('Please specify at least one match pattern.');
      return;
    }

    if (isEditing) {
      updateMutation.mutate({
        id: isEditing,
        input: { name, matchPatterns: patterns, color },
      });
    } else {
      createMutation.mutate({
        name,
        matchPatterns: patterns,
        color,
      });
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!categories || !isProjectAdmin) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= categories.length) return;

    const newOrder = [...categories];
    const temp = newOrder[index];
    newOrder[index] = newOrder[nextIndex];
    newOrder[nextIndex] = temp;

    reorderMutation.mutate(newOrder.map((c) => c.id));
  };

  return (
    <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-xs text-gray-500">
              <li>
                <Link to={`/projects/${projectId}`} className="hover:text-gray-700">
                  Dashboard
                </Link>
              </li>
              <li>
                <span className="mx-1">/</span>
              </li>
              <li className="font-semibold text-gray-900">Feature Categories</li>
            </ol>
          </nav>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Feature Categories Configuration</h1>
          <p className="text-xs text-gray-500 mt-1">
            Map issue key prefixes and labels to feature categories for progress tracking.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left Side: Create/Edit Form */}
        <div className="md:col-span-1">
          {isProjectAdmin ? (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">
                {isEditing ? 'Edit Category' : 'Create Category'}
              </h2>

              <Input
                label="Category Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Attendance Management"
                required
              />

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Match Patterns (comma-separated)
                </label>
                <textarea
                  value={matchPatterns}
                  onChange={(e) => setMatchPatterns(e.target.value)}
                  placeholder="e.g. ATT-, attendance, badge"
                  required
                  rows={3}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-gray-400"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Matches issue keys starting with pattern or tags containing label.
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Color Theme</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      className={[
                        'w-6 h-6 rounded-full border transition-all',
                        color === c.hex
                          ? 'ring-2 ring-brand-500 border-white scale-110 shadow-sm'
                          : 'border-gray-200 hover:scale-105',
                      ].join(' ')}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
                <Input
                  label="Or Custom Hex Code"
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#HexCode"
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  size="sm"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {isEditing ? 'Save Changes' : 'Create'}
                </Button>
                {isEditing && (
                  <Button type="button" variant="secondary" size="sm" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
              Only project administrators can create or edit feature categories.
            </div>
          )}
        </div>

        {/* Right Side: List & Reordering */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Active Categories</h2>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : !categories || categories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-xs text-gray-500">
                No categories configured yet. Categories are unique per project settings.
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((cat, index) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="w-3.5 h-3.5 rounded-full inline-block mt-0.5 shrink-0 shadow-sm border border-black/5"
                        style={{ backgroundColor: cat.color || '#94A3B8' }}
                      />
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">{cat.name}</h4>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cat.matchPatterns.map((pat) => (
                            <span
                              key={pat}
                              className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-mono text-gray-600"
                            >
                              {pat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isProjectAdmin && (
                        <>
                          {/* Reordering Controls */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMove(index, 'up')}
                              disabled={index === 0}
                              className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:pointer-events-none p-0.5 text-xs font-bold leading-none"
                              title="Move Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(index, 'down')}
                              disabled={index === categories.length - 1}
                              className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:pointer-events-none p-0.5 text-xs font-bold leading-none"
                              title="Move Down"
                            >
                              ▼
                            </button>
                          </div>

                           <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => handleEditClick(cat)}>
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={deleteMutation.isPending}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to delete "${cat.name}"? Historical issue metrics will retain the category, but future runs won't map to it.`
                                  )
                                ) {
                                  deleteMutation.mutate(cat.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
