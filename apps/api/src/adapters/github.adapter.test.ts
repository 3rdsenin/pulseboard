import { describe, it, expect, vi, afterEach } from 'vitest';
import { GitHubAdapter } from './github.adapter.js';

function mockCommit(sha: string) {
  return {
    sha,
    commit: {
      message: 'A commit message\n\nlonger body',
      author: { name: 'Alice', email: 'alice@example.com', date: '2026-07-01T00:00:00Z' },
    },
  };
}

describe('GitHubAdapter.fetchCommits', () => {
  const adapter = new GitHubAdapter();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('propagates an authentication failure instead of silently returning zero commits', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      ({ ok: false, status: 401, text: async () => 'Bad credentials' }) as unknown as Response
    ));

    await expect(
      adapter.fetchCommits(
        { type: 'GITHUB', repos: ['owner/repo'] },
        { personalAccessToken: 'invalid-token' }
      )
    ).rejects.toThrow(/401/);
  });

  it('skips a single renamed/deleted repo (404) but still returns commits from the others', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('repos/owner/gone/commits')) {
        return { ok: false, status: 404, text: async () => 'Not Found' } as unknown as Response;
      }
      if (url.includes('repos/owner/exists/commits')) {
        return { ok: true, status: 200, json: async () => [mockCommit('abc123')] } as unknown as Response;
      }
      throw new Error(`unexpected fetch call: ${url}`);
    }));

    const commits = await adapter.fetchCommits(
      { type: 'GITHUB', repos: ['owner/gone', 'owner/exists'] },
      { personalAccessToken: 'valid-token' }
    );

    expect(commits).toHaveLength(1);
    expect(commits[0].sha).toBe('abc123');
    expect(commits[0].repo).toBe('owner/exists');
  });
});
