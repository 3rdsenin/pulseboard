import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import type { IntegrationType } from '../adapters/integration.adapter.js';

interface CreateIntegrationInput {
  type: IntegrationType;
  config: Record<string, unknown>;
  credentials: Record<string, string>;
}

interface UpdateIntegrationInput {
  config?: Record<string, unknown>;
  credentials?: Record<string, string>;
}

export class IntegrationService {
  async listIntegrations(organizationId: string, projectId: string) {
    return db('integrations')
      .where({ organization_id: organizationId, project_id: projectId, deleted_at: null })
      // credentials_encrypted is never selected — only the service can touch that column
      .select('id', 'type', 'config', 'status', 'last_tested_at', 'last_error', 'created_at');
  }

  async getIntegration(organizationId: string, projectId: string, integrationId: string) {
    return db('integrations')
      .where({ id: integrationId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .first('id', 'type', 'config', 'status', 'last_tested_at', 'last_error', 'created_at');
  }

  async createIntegration(
    organizationId: string,
    projectId: string,
    input: CreateIntegrationInput,
    actorId: string
  ) {
    const credentialsEncrypted = encrypt(JSON.stringify(input.credentials));

    const [integration] = await db('integrations')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        type: input.type,
        config: JSON.stringify(input.config),
        credentials_encrypted: credentialsEncrypted,
        status: 'ACTIVE',
        created_by: actorId,
      })
      .returning(['id', 'type', 'config', 'status', 'created_at']);

    return integration;
  }

  async updateIntegration(
    organizationId: string,
    projectId: string,
    integrationId: string,
    input: UpdateIntegrationInput
  ) {
    const updates: Record<string, unknown> = { updated_at: db.fn.now() };
    if (input.config !== undefined) updates.config = JSON.stringify(input.config);
    if (input.credentials !== undefined) {
      // Re-encrypt with a fresh IV so the new ciphertext differs from the old one
      // even if the credential value is unchanged.
      updates.credentials_encrypted = encrypt(JSON.stringify(input.credentials));
    }

    const [updated] = await db('integrations')
      .where({ id: integrationId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .update(updates)
      .returning(['id', 'type', 'config', 'status', 'last_tested_at', 'last_error']);

    return updated ?? null;
  }

  async deleteIntegration(organizationId: string, projectId: string, integrationId: string) {
    const affected = await db('integrations')
      .where({ id: integrationId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .update({ deleted_at: db.fn.now() });
    if (!affected) {
      throw Object.assign(new Error('Integration not found'), { statusCode: 404 });
    }
  }

  // Decrypts and returns credentials for use by sync workers only.
  // This method must never be called from a route handler.
  async getDecryptedCredentials(integrationId: string): Promise<Record<string, string>> {
    const row = await db('integrations')
      .where({ id: integrationId, deleted_at: null })
      .first('credentials_encrypted');
    if (!row) throw new Error('Integration not found');
    return JSON.parse(decrypt(row.credentials_encrypted)) as Record<string, string>;
  }

  async markTestResult(integrationId: string, ok: boolean, errorDetail?: string) {
    await db('integrations')
      .where({ id: integrationId })
      .update({
        status: ok ? 'ACTIVE' : 'ERROR',
        last_tested_at: db.fn.now(),
        last_error: ok ? null : errorDetail ?? 'Unknown error',
        updated_at: db.fn.now(),
      });
  }
}
