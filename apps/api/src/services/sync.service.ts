import db from '../db/index.js';
import { enqueueFullSync } from '../workers/scheduler.js';

export class SyncService {
  async triggerManualSync(
    organizationId: string,
    projectId: string,
    actorId: string,
    since?: Date
  ) {
    return enqueueFullSync(organizationId, projectId, 'MANUAL', actorId, since);
  }

  async listSyncJobs(organizationId: string, projectId: string, limit = 20) {
    return db('sync_jobs')
      .where({ organization_id: organizationId, project_id: projectId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select(
        'id', 'type', 'status',
        'triggered_by as triggeredBy', 'triggered_by_user_id as triggeredByUserId',
        'started_at as startedAt', 'completed_at as completedAt',
        'records_processed as recordsProcessed', 'error_message as errorMessage',
        'created_at as createdAt'
      );
  }

  async getSyncJob(organizationId: string, syncJobId: string) {
    return db('sync_jobs')
      .where({ id: syncJobId, organization_id: organizationId })
      .first(
        'id', 'type', 'status',
        'triggered_by as triggeredBy',
        'started_at as startedAt', 'completed_at as completedAt',
        'records_processed as recordsProcessed', 'error_message as errorMessage',
        'created_at as createdAt'
      );
  }
}
