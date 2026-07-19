import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contributorsApi, type Contributor } from '../../api/contributors.js';
import { projectsApi } from '../../api/projects.js';
import { useAuth } from '../../hooks/useAuth.js';
import { extractApiError } from '../../api/client.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Spinner } from '../../components/Spinner.js';

export function ContributorsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingContributor, setEditingContributor] = useState<Contributor | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [jiraAccountId, setJiraAccountId] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [newAlias, setNewAlias] = useState<Record<string, string>>({}); // keyed by contributorId

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

  const { data: contributors, isLoading: loadingContributors } = useQuery({
    queryKey: ['contributors', projectId, includeInactive],
    queryFn: () => contributorsApi.list(projectId!, includeInactive),
    enabled: !!projectId,
  });

  // Auth checking
  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const member = projectMembers?.find((m) => m.userId === user?.userId);
  const isProjectAdmin = isOrgAdmin || member?.role === 'PROJECT_ADMIN';

  // Mutations
  const createMutation = useMutation({
    mutationFn: () =>
      contributorsApi.create(projectId!, {
        displayName,
        email: email || undefined,
        jiraAccountId: jiraAccountId || undefined,
        githubUsername: githubUsername || undefined,
        roleLabel: roleLabel || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors', projectId] });
      resetForm();
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      contributorsApi.update(projectId!, id, {
        displayName,
        email,
        jiraAccountId,
        githubUsername,
        roleLabel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors', projectId] });
      resetForm();
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      contributorsApi.update(projectId!, id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contributorsApi.delete(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors', projectId] });
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const addAliasMutation = useMutation({
    mutationFn: ({ contributorId, alias }: { contributorId: string; alias: string }) =>
      contributorsApi.addAlias(projectId!, contributorId, alias),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contributors', projectId] });
      setNewAlias((prev) => ({ ...prev, [variables.contributorId]: '' }));
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const removeAliasMutation = useMutation({
    mutationFn: ({ contributorId, aliasId }: { contributorId: string; aliasId: string }) =>
      contributorsApi.removeAlias(projectId!, contributorId, aliasId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors', projectId] });
    },
    onError: async (err) => setError(await extractApiError(err)),
  });

  const handleEditClick = (c: Contributor) => {
    setEditingContributor(c);
    setIsAdding(false);
    setDisplayName(c.display_name);
    setEmail(c.email ?? '');
    setJiraAccountId(c.jira_account_id ?? '');
    setGithubUsername(c.github_username ?? '');
    setRoleLabel(c.role_label ?? '');
    setError(null);
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setEditingContributor(null);
    setDisplayName('');
    setEmail('');
    setJiraAccountId('');
    setGithubUsername('');
    setRoleLabel('');
    setError(null);
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingContributor(null);
    setDisplayName('');
    setEmail('');
    setJiraAccountId('');
    setGithubUsername('');
    setRoleLabel('');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    if (isAdding) {
      createMutation.mutate();
    } else if (editingContributor) {
      updateMutation.mutate(editingContributor.id);
    }
  };

  const isLoading = loadingProject || loadingMembers || loadingContributors;

  if (isLoading) {
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
            <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to Project
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-900">{project?.name} — Contributors</h1>
          </div>
          {isProjectAdmin && !isAdding && !editingContributor && (
            <Button variant="primary" size="sm" onClick={handleAddClick}>
              Add Contributor
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
        {(isAdding || editingContributor) && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {isAdding ? 'Add New Contributor' : `Edit Contributor: ${editingContributor?.display_name}`}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Display Name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Paul Mensah"
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. paul@amalitech.com"
              />
              <Input
                label="Jira Account ID"
                value={jiraAccountId}
                onChange={(e) => setJiraAccountId(e.target.value)}
                placeholder="e.g. 557058:..."
                hint="Find this in the user's Jira profile URL or API payload"
              />
              <Input
                label="GitHub Username"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="e.g. paulmensah"
              />
              <Input
                label="Role / Title"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
              />
              <div className="sm:col-span-2 flex items-center justify-end gap-3 mt-4">
                <Button variant="secondary" type="button" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {isAdding ? 'Add Contributor' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
            />
            Show deactivated contributors
          </label>
        </div>

        {/* Contributors List */}
        {(contributors?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">
              No contributors found. Click &quot;Add Contributor&quot; to populate your team.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {contributors?.map((c) => (
              <div
                key={c.id}
                className={[
                  'rounded-lg border bg-white p-6 shadow-sm flex flex-col justify-between transition-all',
                  c.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50/50 opacity-70',
                ].join(' ')}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        {c.display_name}
                        {!c.is_active && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Inactive
                          </span>
                        )}
                      </h4>
                      {c.role_label && <p className="text-xs text-gray-500 mt-0.5">{c.role_label}</p>}
                    </div>

                    {isProjectAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(c)}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() =>
                            toggleActiveMutation.mutate({ id: c.id, isActive: !c.is_active })
                          }
                          className="text-xs font-semibold text-gray-600 hover:text-gray-700"
                        >
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${c.display_name}?`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Account Mappings */}
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-gray-100 pt-4">
                    <div>
                      <span className="text-gray-400 block font-medium">Jira Account ID</span>
                      <span className="text-gray-700 break-all font-mono">
                        {c.jira_account_id ?? '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">GitHub Username</span>
                      <span className="text-gray-700 font-mono">
                        {c.github_username ? `@${c.github_username}` : '—'}
                      </span>
                    </div>
                    <div className="col-span-2 mt-1">
                      <span className="text-gray-400 block font-medium">Email Address</span>
                      <span className="text-gray-700">{c.email ?? '—'}</span>
                    </div>
                  </div>

                  {/* Name Aliases Section */}
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <span className="text-xs text-gray-400 font-medium block mb-2">Name Aliases</span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {c.aliases && c.aliases.length > 0 ? (
                        c.aliases.map((alias) => (
                          <span
                            key={alias.id}
                            className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                          >
                            {alias.alias}
                            {isProjectAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  removeAliasMutation.mutate({
                                    contributorId: c.id,
                                    aliasId: alias.id,
                                  })
                                }
                                className="text-brand-400 hover:text-brand-600 focus:outline-none"
                              >
                                &times;
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No aliases defined</span>
                      )}
                    </div>

                    {isProjectAdmin && (
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder="Add alias..."
                          value={newAlias[c.id] ?? ''}
                          onChange={(e) =>
                            setNewAlias((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newAlias[c.id]?.trim()) {
                              addAliasMutation.mutate({
                                contributorId: c.id,
                                alias: newAlias[c.id].trim(),
                              });
                            }
                          }}
                          className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="px-2.5 py-1 text-xs"
                          disabled={!newAlias[c.id]?.trim() || addAliasMutation.isPending}
                          onClick={() =>
                            addAliasMutation.mutate({
                              contributorId: c.id,
                              alias: newAlias[c.id].trim(),
                            })
                          }
                        >
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
