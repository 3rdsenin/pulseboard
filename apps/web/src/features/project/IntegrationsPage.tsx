import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi, type ConnectionResult, type Integration } from '../../api/integrations.js';
import { syncApi } from '../../api/sync.js';
import { extractApiError } from '../../api/client.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Card, CardBody, CardHeader } from '../../components/Card.js';
import { Spinner } from '../../components/Spinner.js';

type IntegrationType = 'JIRA' | 'GITHUB';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  ERROR: 'bg-red-100 text-red-700',
  PAUSED: 'bg-gray-100 text-gray-600',
};

export function IntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations', projectId],
    queryFn: () => integrationsApi.list(projectId!),
    enabled: !!projectId,
  });

  const { data: syncJobs, isLoading: isLoadingSync } = useQuery({
    queryKey: ['sync-jobs', projectId],
    queryFn: () => syncApi.listJobs(projectId!),
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const [type, setType] = useState<IntegrationType>('JIRA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [boardId, setBoardId] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [repos, setRepos] = useState('');
  const [personalAccessToken, setPersonalAccessToken] = useState('');

  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Board links look like .../boards/323 — auto-fill Board ID from a pasted link so
  // sprint sync works without the user needing to know it's a separate field.
  function handleBaseUrlChange(value: string) {
    setBaseUrl(value);
    if (!boardId) {
      const match = value.match(/\/boards\/(\d+)/);
      if (match) setBoardId(match[1]);
    }
  }

  function buildPayload(): { type: IntegrationType; config: Record<string, unknown>; credentials: Record<string, string> } {
    if (type === 'JIRA') {
      return {
        type: 'JIRA',
        config: { baseUrl, projectKey, boardId: boardId || undefined },
        credentials: { email, apiToken },
      };
    }
    return {
      type: 'GITHUB',
      config: { repos: repos.split(',').map((r) => r.trim()).filter(Boolean) },
      credentials: { personalAccessToken },
    };
  }

  function resetForm() {
    setEditingId(null);
    setBaseUrl('');
    setProjectKey('');
    setBoardId('');
    setEmail('');
    setApiToken('');
    setRepos('');
    setPersonalAccessToken('');
    setTestResult(null);
    setFormError(null);
  }

  function startEdit(integration: Integration) {
    setEditingId(integration.id);
    setType(integration.type as IntegrationType);
    setFormError(null);
    setTestResult(null);

    const config = integration.config || {};
    if (integration.type === 'JIRA') {
      setBaseUrl((config.baseUrl as string) || '');
      setProjectKey((config.projectKey as string) || '');
      setBoardId((config.boardId as string) || '');
      setEmail('');
      setApiToken('');
    } else {
      setRepos(((config.repos as string[]) || []).join(', '));
      setPersonalAccessToken('');
    }
  }

  const testConnection = useMutation({
    mutationFn: () => integrationsApi.testConnection(projectId!, buildPayload()),
    onSuccess: (result) => setTestResult(result),
    onError: async (error) => setTestResult({ ok: false, detail: await extractApiError(error) }),
  });

  const createIntegration = useMutation({
    mutationFn: () => integrationsApi.create(projectId!, buildPayload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', projectId] });
      resetForm();
    },
    onError: async (error) => setFormError(await extractApiError(error)),
  });

  const updateIntegration = useMutation({
    mutationFn: () => integrationsApi.update(projectId!, editingId!, buildPayload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', projectId] });
      resetForm();
    },
    onError: async (error) => setFormError(await extractApiError(error)),
  });

  const deleteIntegration = useMutation({
    mutationFn: (id: string) => integrationsApi.delete(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', projectId] });
    },
    onError: async (error) => setFormError(await extractApiError(error)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateIntegration.mutate();
    } else {
      createIntegration.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to project
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Integrations</h2>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && (
          <div className="mb-8 flex flex-col gap-3">
            {(integrations?.length ?? 0) === 0 && (
              <p className="text-sm text-gray-500">No integrations connected yet.</p>
            )}
            {integrations?.map((integration) => (
              <Card key={integration.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{integration.type}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {integration.last_tested_at
                        ? `Last tested ${new Date(integration.last_tested_at).toLocaleString()}`
                        : 'Never tested'}
                    </p>
                    {integration.last_error && (
                      <p className="mt-1 text-xs text-red-600">{integration.last_error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[integration.status]}`}>
                      {integration.status}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(integration)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        loading={deleteIntegration.isPending}
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove this ${integration.type} integration?`)) {
                            deleteIntegration.mutate(integration.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <h3 className="font-medium text-gray-900">
              {editingId ? `Edit ${type} Integration` : 'Add integration'}
            </h3>
          </CardHeader>
          <CardBody>
            {!editingId && (
              <div className="mb-4 flex gap-2">
                <Button
                  type="button"
                  variant={type === 'JIRA' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => { setType('JIRA'); setTestResult(null); }}
                >
                  Jira
                </Button>
                <Button
                  type="button"
                  variant={type === 'GITHUB' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => { setType('GITHUB'); setTestResult(null); }}
                >
                  GitHub
                </Button>
              </div>
            )}

            {formError && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {type === 'JIRA' ? (
                <>
                  <Input
                    label="Base URL"
                    hint="Your Jira Cloud site or a board/project link — either works, e.g. https://your-team.atlassian.net"
                    value={baseUrl}
                    onChange={(e) => handleBaseUrlChange(e.target.value)}
                  />
                  <Input
                    label="Project key"
                    hint="The short code shown in Jira issue IDs, e.g. PROJ"
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value)}
                  />
                  <Input
                    label="Board ID"
                    hint="Needed for sprint data — auto-filled if your Base URL is a board link, or find it in the board's URL (.../boards/123)"
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                  />
                  <Input
                    label="Email"
                    hint={editingId ? 'Leave blank to keep current' : 'The Atlassian account email the API token belongs to'}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    label="API token"
                    hint={editingId ? 'Leave blank to keep current' : 'Create one at id.atlassian.com/manage-profile/security/api-tokens'}
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Repositories"
                    hint="Comma-separated owner/repo pairs, e.g. my-org/my-repo, my-org/other-repo"
                    value={repos}
                    onChange={(e) => setRepos(e.target.value)}
                  />
                  <Input
                    label="Personal access token"
                    hint={editingId ? 'Leave blank to keep current' : 'A GitHub token with repo read access'}
                    type="password"
                    value={personalAccessToken}
                    onChange={(e) => setPersonalAccessToken(e.target.value)}
                  />
                </>
              )}

              {testResult && (
                <p className={`text-sm ${testResult.ok ? 'text-green-700' : 'text-red-600'}`}>
                  {testResult.ok ? 'Connection successful.' : (testResult.detail ?? 'Connection failed.')}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  loading={testConnection.isPending}
                  onClick={() => testConnection.mutate()}
                >
                  Test connection
                </Button>
                <Button
                  type="submit"
                  loading={createIntegration.isPending || updateIntegration.isPending}
                >
                  {editingId ? 'Update Integration' : 'Save integration'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Sync History Table */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900 text-sm">Sync History (Last 20 Runs)</h3>
              {isLoadingSync && <Spinner size="sm" />}
            </div>
          </CardHeader>
          <CardBody>
            {isLoadingSync && !syncJobs ? (
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            ) : !syncJobs || syncJobs.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No sync history found for this project.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-500 border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[9px]">
                      <th className="px-4 py-2">Job ID</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Trigger</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Records</th>
                      <th className="px-4 py-2">Started</th>
                      <th className="px-4 py-2">Duration</th>
                      <th className="px-4 py-2">Errors / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {syncJobs.map((job) => {
                      const duration = job.startedAt && job.completedAt
                        ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
                        : '—';

                      return (
                        <tr key={job.id} className="hover:bg-gray-50/30">
                          <td className="px-4 py-2 font-mono font-semibold text-[9px] text-gray-400">
                            {job.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {job.type}
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-[10px]">
                            {job.triggeredBy}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={[
                                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold border',
                                job.status === 'SUCCESS'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : job.status === 'FAILED'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200',
                              ].join(' ')}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono">
                            {job.recordsProcessed ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-[10px]">
                            {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-2 font-mono text-gray-900 text-[10px]">
                            {duration}
                          </td>
                          <td className="px-4 py-2 text-red-600 truncate max-w-xs text-[10px]" title={job.errorMessage || undefined}>
                            {job.errorMessage || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

