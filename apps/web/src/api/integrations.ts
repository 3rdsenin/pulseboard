import { api } from './client.js';
import type { CreateIntegrationInput, TestConnectionInput } from '@pulseboard/shared';

export interface Integration {
  id: string;
  type: 'JIRA' | 'GITHUB' | 'GITLAB' | 'LINEAR';
  config: Record<string, unknown>;
  status: 'ACTIVE' | 'ERROR' | 'PAUSED';
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface ConnectionResult {
  ok: boolean;
  detail?: string;
}

export const integrationsApi = {
  list: (projectId: string) =>
    api.get(`projects/${projectId}/integrations`).json<Integration[]>(),

  create: (projectId: string, input: CreateIntegrationInput) =>
    api.post(`projects/${projectId}/integrations`, { json: input }).json<Integration>(),

  testConnection: (projectId: string, input: TestConnectionInput) =>
    api.post(`projects/${projectId}/integrations/test-connection`, { json: input }).json<ConnectionResult>(),

  delete: (projectId: string, integrationId: string) =>
    api.delete(`projects/${projectId}/integrations/${integrationId}`),
};
