import type {
  IntegrationAdapter,
  IntegrationConfig,
  ConnectionResult,
  RawIssue,
  RawCommit,
  RawSprint,
} from './integration.adapter.js';

// Jira Cloud REST API v3 + Agile API (sprints). Jira Server/DC uses different base
// paths — not supported yet.
export class JiraAdapter implements IntegrationAdapter {
  readonly type = 'JIRA' as const;

  // Returns a helper that sends authenticated GET requests to the Jira REST API.
  // Uses native fetch (available in Node 22) to avoid adding a browser-first HTTP dep.
  // basePath defaults to the platform API (/rest/api/3); sprint data lives under the
  // separate Agile API (/rest/agile/1.0), which this same client can also reach.
  private makeClient(config: IntegrationConfig, credentials: Record<string, string>, basePath = '/rest/api/3') {
    const { email, apiToken } = credentials;
    const { baseUrl } = config;
    if (!baseUrl || !email || !apiToken) {
      throw new Error('Jira integration requires baseUrl, email, and apiToken');
    }

    // Users commonly paste a board/project deep link (e.g. copied from their browser
    // while looking at a board) instead of the bare site URL — normalise to the origin
    // so /rest/api/3/... always resolves correctly regardless of what path was pasted.
    let origin: string;
    try {
      origin = new URL(baseUrl).origin;
    } catch {
      throw new Error(`"${baseUrl}" is not a valid URL — use your Jira site address, e.g. https://your-team.atlassian.net`);
    }

    const baseHeaders = {
      Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      Accept: 'application/json',
    };
    const apiBase = `${origin}${basePath}`;

    return {
      async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
        const url = new URL(`${apiBase}/${path}`);
        if (params) {
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
        }
        const res = await fetch(url.toString(), { headers: baseHeaders });
        if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          throw new Error(
            `Jira returned an unexpected ${contentType || 'non-JSON'} response instead of API data — ` +
            'double check the base URL is your Jira site address, not a board or project link.'
          );
        }
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
    let nextPageToken: string | undefined;

    // /rest/api/3/search was removed by Atlassian (410 Gone) in favour of /search/jql,
    // which drops startAt/total entirely and paginates via nextPageToken + isLast instead.
    while (true) {
      const params: Record<string, string | number> = {
        jql,
        maxResults: 100,
        fields: 'summary,status,issuetype,priority,assignee,labels,created,updated',
      };
      if (nextPageToken) params.nextPageToken = nextPageToken;

      const page = await client.get<{ issues: JiraIssue[]; nextPageToken?: string; isLast: boolean }>(
        'search/jql',
        params
      );

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

      if (page.isLast || !page.nextPageToken) break;
      nextPageToken = page.nextPageToken;
    }

    return issues;
  }

  // Jira does not expose commit data — the GitHub adapter handles commits
  async fetchCommits(): Promise<RawCommit[]> {
    return [];
  }

  // Sprints are scoped to a board (not a project) in Jira's Agile API — projects can
  // have multiple boards, so a board must be explicitly configured. No boardId means
  // this integration isn't board/sprint-driven; return no sprints rather than guessing.
  async fetchSprints(config: IntegrationConfig, credentials: Record<string, string>): Promise<RawSprint[]> {
    const { boardId } = config;
    if (!boardId) return [];

    const client = this.makeClient(config, credentials, '/rest/agile/1.0');
    const sprints: RawSprint[] = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const page = await client.get<{ values: JiraAgileSprint[]; isLast: boolean }>(`board/${boardId}/sprint`, {
        startAt,
        maxResults,
      });

      for (const s of page.values) {
        sprints.push({
          externalId: String(s.id),
          name: s.name,
          state: s.state.toUpperCase() as RawSprint['state'],
          startDate: s.startDate?.split('T')[0],
          endDate: s.endDate?.split('T')[0],
          completeDate: s.completeDate?.split('T')[0],
          goal: s.goal,
        });
      }

      startAt += page.values.length;
      if (page.isLast || page.values.length === 0) break;
    }

    return sprints;
  }

  // Issue keys for a single sprint (fields=key only — this is a membership lookup,
  // not a data fetch; full issue data still comes from fetchIssues's project-wide JQL search).
  async fetchSprintIssueKeys(
    config: IntegrationConfig,
    credentials: Record<string, string>,
    sprintExternalId: string
  ): Promise<string[]> {
    const client = this.makeClient(config, credentials, '/rest/agile/1.0');
    const keys: string[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const page = await client.get<{ issues: { key: string }[]; total: number }>(
        `sprint/${sprintExternalId}/issue`,
        { startAt, maxResults, fields: 'key' }
      );

      for (const issue of page.issues) keys.push(issue.key);

      startAt += page.issues.length;
      if (startAt >= page.total || page.issues.length === 0) break;
    }

    return keys;
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

interface JiraAgileSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
}
