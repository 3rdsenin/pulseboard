import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi, type ConnectionResult } from '../../api/integrations.js';
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

  const [type, setType] = useState<IntegrationType>('JIRA');
  const [baseUrl, setBaseUrl] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [repos, setRepos] = useState('');
  const [personalAccessToken, setPersonalAccessToken] = useState('');

  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function buildPayload(): { type: IntegrationType; config: Record<string, unknown>; credentials: Record<string, string> } {
    if (type === 'JIRA') {
      return {
        type: 'JIRA',
        config: { baseUrl, projectKey },
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
    setBaseUrl('');
    setProjectKey('');
    setEmail('');
    setApiToken('');
    setRepos('');
    setPersonalAccessToken('');
    setTestResult(null);
    setFormError(null);
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
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[integration.status]}`}>
                    {integration.status}
                  </span>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <h3 className="font-medium text-gray-900">Add integration</h3>
          </CardHeader>
          <CardBody>
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

            {formError && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}

            <div className="flex flex-col gap-4">
              {type === 'JIRA' ? (
                <>
                  <Input
                    label="Base URL"
                    hint="Your Jira Cloud site, e.g. https://your-team.atlassian.net"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                  <Input
                    label="Project key"
                    hint="The short code shown in Jira issue IDs, e.g. PROJ"
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value)}
                  />
                  <Input
                    label="Email"
                    hint="The Atlassian account email the API token belongs to"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    label="API token"
                    hint="Create one at id.atlassian.com/manage-profile/security/api-tokens"
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
                    hint="A GitHub token with repo read access"
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
                  type="button"
                  loading={createIntegration.isPending}
                  onClick={() => createIntegration.mutate()}
                >
                  Save integration
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
