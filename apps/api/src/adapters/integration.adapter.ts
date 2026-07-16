// IntegrationAdapter is the single interface every data-source integration must implement.
// Adding a new integration (e.g. GitLab) means creating a new class — the sync worker
// never needs to change (ADR PB-005).

export type IntegrationType = 'JIRA' | 'GITHUB' | 'GITLAB' | 'LINEAR';

export interface IntegrationConfig {
  type: IntegrationType;
  baseUrl?: string;
  projectKey?: string;
  boardId?: string;
  repos?: string[];
  [key: string]: unknown;
}

export interface ConnectionResult {
  ok: boolean;
  detail?: string;
}

export interface RawIssue {
  externalKey: string;
  summary: string;
  status: string;
  issueType: string;
  priority?: string;
  assigneeId?: string;
  labels: string[];
  createdDate?: string;
  updatedDate?: string;
  rawPayload?: Record<string, unknown>;
}

export interface RawCommit {
  sha: string;
  message: string;
  authorEmail?: string;
  authorName?: string;
  repo: string;
  committedAt: string;
}

export interface RawSprint {
  externalId: string;
  name: string;
  state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
}

export interface IntegrationAdapter {
  readonly type: IntegrationType;
  testConnection(config: IntegrationConfig, credentials: Record<string, string>): Promise<ConnectionResult>;
  fetchIssues(config: IntegrationConfig, credentials: Record<string, string>, since?: Date): Promise<RawIssue[]>;
  fetchCommits(config: IntegrationConfig, credentials: Record<string, string>, since?: Date): Promise<RawCommit[]>;
  // Sprints are board-scoped (Jira Agile API) — adapters without a sprint concept (GitHub) return [].
  fetchSprints(config: IntegrationConfig, credentials: Record<string, string>): Promise<RawSprint[]>;
  // Issue keys belonging to a given sprint, for linking issue_snapshots.sprint_id after sprints are upserted.
  fetchSprintIssueKeys(
    config: IntegrationConfig,
    credentials: Record<string, string>,
    sprintExternalId: string
  ): Promise<string[]>;
}
