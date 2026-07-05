// IntegrationAdapter is the single interface every data-source integration must implement.
// Adding a new integration (e.g. GitLab) means creating a new class — the sync worker
// never needs to change (ADR PB-005).

export type IntegrationType = 'JIRA' | 'GITHUB' | 'GITLAB' | 'LINEAR';

export interface IntegrationConfig {
  type: IntegrationType;
  baseUrl?: string;
  projectKey?: string;
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

export interface IntegrationAdapter {
  readonly type: IntegrationType;
  testConnection(config: IntegrationConfig, credentials: Record<string, string>): Promise<ConnectionResult>;
  fetchIssues(config: IntegrationConfig, credentials: Record<string, string>, since?: Date): Promise<RawIssue[]>;
  fetchCommits(config: IntegrationConfig, credentials: Record<string, string>, since?: Date): Promise<RawCommit[]>;
}
