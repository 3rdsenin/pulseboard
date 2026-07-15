import type {
  IntegrationAdapter,
  IntegrationConfig,
  ConnectionResult,
  RawIssue,
  RawCommit,
} from './integration.adapter.js';

export class GitHubApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

// GitHub REST API v3 (api.github.com). Supports PAT (personal access token) auth.
export class GitHubAdapter implements IntegrationAdapter {
  readonly type = 'GITHUB' as const;

  // Returns a helper that sends authenticated GET requests to the GitHub REST API.
  // Uses native fetch (available in Node 22) to avoid adding a browser-first HTTP dep.
  private makeClient(credentials: Record<string, string>) {
    const { personalAccessToken } = credentials;
    if (!personalAccessToken) {
      throw new Error('GitHub integration requires personalAccessToken');
    }

    const baseHeaders = {
      Authorization: `Bearer ${personalAccessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    return {
      async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
        const url = new URL(`https://api.github.com/${path}`);
        if (params) {
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
        }
        const res = await fetch(url.toString(), { headers: baseHeaders });
        if (!res.ok) {
          const error = new GitHubApiError(`GitHub ${res.status}: ${await res.text()}`, res.status);
          throw error;
        }
        return res.json() as Promise<T>;
      },
    };
  }

  async testConnection(
    _config: IntegrationConfig,
    credentials: Record<string, string>
  ): Promise<ConnectionResult> {
    try {
      await this.makeClient(credentials).get('user');
      return { ok: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, detail: msg };
    }
  }

  // GitHub issues are tracked in Jira for this project — fetchIssues is a no-op
  async fetchIssues(): Promise<RawIssue[]> {
    return [];
  }

  async fetchCommits(
    config: IntegrationConfig,
    credentials: Record<string, string>,
    since?: Date
  ): Promise<RawCommit[]> {
    const client = this.makeClient(credentials);
    const repos = (config.repos as string[] | undefined) ?? [];
    if (repos.length === 0) return [];

    const commits: RawCommit[] = [];

    for (const repo of repos) {
      // repo format: "owner/repo"
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) continue;

      let page = 1;
      const perPage = 100;

      while (true) {
        const params: Record<string, string | number> = { per_page: perPage, page };
        if (since) params.since = since.toISOString();

        // A single renamed/deleted repo (404) shouldn't abort the whole sync — but
        // auth failures, rate limits, and other errors affect every repo and must
        // propagate so the sync job fails and the integration is marked ERROR,
        // instead of silently reporting success with zero commits.
        const batch: GitHubCommit[] = await client
          .get<GitHubCommit[]>(`repos/${owner}/${repoName}/commits`, params)
          .catch((error: unknown) => {
            if (error instanceof GitHubApiError && error.status === 404) return [];
            throw error;
          });

        for (const c of batch) {
          commits.push({
            sha: c.sha,
            message: c.commit.message.split('\n')[0] ?? '',
            authorEmail: c.commit.author?.email,
            authorName: c.commit.author?.name,
            repo,
            committedAt: c.commit.author?.date ?? new Date().toISOString(),
          });
        }

        if (batch.length < perPage) break;
        page++;
      }
    }

    return commits;
  }
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author?: {
      name?: string;
      email?: string;
      date?: string;
    };
  };
}
