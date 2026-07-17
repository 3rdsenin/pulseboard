import { describe, it, expect, vi, afterEach } from 'vitest';
import { JiraAdapter } from './jira.adapter.js';

describe('JiraAdapter.testConnection', () => {
  const adapter = new JiraAdapter();
  const credentials = { email: 'user@example.com', apiToken: 'token123' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalises a board/project deep link to the site origin instead of failing', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      ({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ accountId: 'abc' }),
      }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.testConnection(
      { type: 'JIRA', baseUrl: 'https://your-team.atlassian.net/jira/software/projects/PROJ/boards/323' },
      credentials
    );

    expect(result.ok).toBe(true);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://your-team.atlassian.net/rest/api/3/myself');
  });

  it('returns a clear error instead of a raw JSON-parse failure when Jira responds with HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      ({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: async () => '<!doctype html><html>...</html>',
      }) as unknown as Response
    ));

    const result = await adapter.testConnection(
      { type: 'JIRA', baseUrl: 'https://your-team.atlassian.net/jira/software/projects/PROJ/boards/323' },
      credentials
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/base url is your jira site address/i);
    expect(result.detail).not.toMatch(/unexpected token/i);
  });

  it('rejects a baseUrl that is not a valid URL with a clear message', async () => {
    const result = await adapter.testConnection(
      { type: 'JIRA', baseUrl: 'not a url' },
      credentials
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/not a valid URL/);
  });
});

function mockIssue(key: string) {
  return {
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: { name: 'To Do' },
      issuetype: { name: 'Task' },
      created: '2026-07-01T00:00:00.000Z',
      updated: '2026-07-02T00:00:00.000Z',
    },
  };
}

describe('JiraAdapter.fetchIssues', () => {
  const adapter = new JiraAdapter();
  const credentials = { email: 'user@example.com', apiToken: 'token123' };
  const config = { type: 'JIRA' as const, baseUrl: 'https://your-team.atlassian.net', projectKey: 'PROJ' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the current search/jql endpoint, not the removed search endpoint', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      ({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ issues: [], isLast: true }),
      }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchMock);

    await adapter.fetchIssues(config, credentials);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/rest/api/3/search/jql');
    expect(calledUrl).not.toContain('startAt');
  });

  it('follows nextPageToken across pages until isLast is true', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ issues: [mockIssue('PROJ-1')], nextPageToken: 'page-2-token', isLast: false }),
        } as unknown as Response;
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ issues: [mockIssue('PROJ-2')], isLast: true }),
      } as unknown as Response;
    }));

    const issues = await adapter.fetchIssues(config, credentials);

    expect(issues.map((i) => i.externalKey)).toEqual(['PROJ-1', 'PROJ-2']);
  });
});

function mockAgileSprint(id: number, state: 'active' | 'closed' | 'future') {
  return { id, name: `Sprint ${id}`, state, startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-07-14T00:00:00.000Z' };
}

describe('JiraAdapter.fetchSprints', () => {
  const adapter = new JiraAdapter();
  const credentials = { email: 'user@example.com', apiToken: 'token123' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns no sprints when no boardId is configured (backward compatible)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sprints = await adapter.fetchSprints(
      { type: 'JIRA', baseUrl: 'https://your-team.atlassian.net', projectKey: 'PROJ' },
      credentials
    );

    expect(sprints).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hits the Agile API (not the platform API) and maps lowercase Jira states to our enum', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      ({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ values: [mockAgileSprint(1, 'active'), mockAgileSprint(2, 'future')], isLast: true }),
      }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchMock);

    const sprints = await adapter.fetchSprints(
      { type: 'JIRA', baseUrl: 'https://your-team.atlassian.net', boardId: '323' },
      credentials
    );

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/rest/agile/1.0/board/323/sprint');
    expect(sprints.map((s) => s.state)).toEqual(['ACTIVE', 'FUTURE']);
    expect(sprints[0].externalId).toBe('1');
  });

  it('paginates with startAt/isLast (the Agile API was not affected by the search deprecation)', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ values: [mockAgileSprint(1, 'closed')], isLast: false }),
        } as unknown as Response;
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ values: [mockAgileSprint(2, 'active')], isLast: true }),
      } as unknown as Response;
    }));

    const sprints = await adapter.fetchSprints(
      { type: 'JIRA', baseUrl: 'https://your-team.atlassian.net', boardId: '323' },
      credentials
    );

    expect(sprints.map((s) => s.externalId)).toEqual(['1', '2']);
  });
});

describe('JiraAdapter.fetchSprintIssueKeys', () => {
  const adapter = new JiraAdapter();
  const credentials = { email: 'user@example.com', apiToken: 'token123' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('collects issue keys for a sprint, paginating with startAt/total', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ issues: [{ key: 'PROJ-1' }], total: 2 }),
        } as unknown as Response;
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ issues: [{ key: 'PROJ-2' }], total: 2 }),
      } as unknown as Response;
    }));

    const keys = await adapter.fetchSprintIssueKeys(
      { type: 'JIRA', baseUrl: 'https://your-team.atlassian.net' },
      credentials,
      '1'
    );

    expect(keys).toEqual(['PROJ-1', 'PROJ-2']);
  });
});
