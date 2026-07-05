export interface User {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  orgRole: 'ORG_ADMIN' | 'ORG_MEMBER';
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  syncCron: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface Contributor {
  id: string;
  displayName: string;
  email: string | null;
  jiraAccountId: string | null;
  githubUsername: string | null;
  roleLabel: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Integration {
  id: string;
  type: 'JIRA' | 'GITHUB' | 'GITLAB' | 'LINEAR';
  config: Record<string, unknown>;
  status: 'ACTIVE' | 'ERROR' | 'PAUSED';
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId?: string;
}
