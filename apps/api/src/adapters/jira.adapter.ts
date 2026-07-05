import type {
  IntegrationAdapter,
  IntegrationConfig,
  ConnectionResult,
  RawIssue,
  RawCommit,
} from './integration.adapter.js';

// Jira Cloud REST API v3. Jira Server/DC uses a different base path — not supported yet.
export class JiraAdapter implements IntegrationAdapter {
  readonly type = 'JIRA' as const;

  // Returns a helper that sends authenticated GET requests to the Jira REST API.
  // Uses native fetch (available in Node 22) to avoid adding a browser-first HTTP dep.
  private makeClient(config: IntegrationConfig, credentials: Record<string, string>) {
    const { email, apiToken } = credentials;
    const { baseUrl } = config;
    if (!baseUrl || !email || !apiToken) {
      throw new Error('Jira integration requires baseUrl, email, and apiToken');
    }

    const baseHeaders = {
      Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      Accept: 'application/json',
    };
    const apiBase = `${baseUrl}/rest/api/3`;

    return {
      async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
        const url = new URL(`${apiBase}/${path}`);
        if (params) {
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
        }
        const res = await fetch(url.toString(), { headers: baseHeaders });
        if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
        return res.json() as Promise<T>;
      },
    };
  }

  async testConnection(
    config: IntegrationConfig,
    credentials: Record<string, string>
  ): Promise<ConnectionResult> {
    try {
      await this.makeClient(config, credentials).get('myself');
      return { ok: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, detail: msg };
    }
  }

  async fetchIssues(
    config: IntegrationConfig,
    credentials: Record<string, string>,
    since?: Date
  ): Promise<RawIssue[]> {
    const client = this.makeClient(config, credentials);
    const { projectKey } = config;
    if (!projectKey) throw new Error('Jira integration requires projectKey');

    let jql = `project = "${projectKey}" ORDER BY updated DESC`;
    if (since) {
      const sinceStr = since.toISOString().split('T')[0];
      jql = `project = "${projectKey}" AND updated >= "${sinceStr}" ORDER BY updated DESC`;
    }

    const issues: RawIssue[] = [];
    let startAt = 0;
    const maxResults = 100;

    // Jira paginates with startAt — fetch until we exhaust all results
    while (true) {
      const page = await client.get<{ issues: JiraIssue[]; total: number }>('search', {
        jql,
        startAt,
        maxResults,
        fields: 'summary,status,issuetype,priority,assignee,labels,created,updated',
      });

      for (const issue of page.issues) {
        issues.push({
          externalKey: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          issueType: issue.fields.issuetype.name,
          priority: issue.fields.priority?.name,
          assigneeId: issue.fields.assignee?.accountId,
          labels: issue.fields.labels ?? [],
          createdDate: issue.fields.created?.split('T')[0],
          updatedDate: issue.fields.updated?.split('T')[0],
          rawPayload: issue.fields as unknown as Record<string, unknown>,
        });
      }

      startAt += page.issues.length;
      if (startAt >= page.total || page.issues.length === 0) break;
    }

    return issues;
  }

  // Jira does not expose commit data — the GitHub adapter handles commits
  async fetchCommits(): Promise<RawCommit[]> {
    return [];
  }
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    priority?: { name: string };
    assignee?: { accountId: string; displayName: string };
    labels?: string[];
    created?: string;
    updated?: string;
  };
}
