import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// One connection shared by all queues — BullMQ requires maxRetriesPerRequest: null
// on the connection used for workers/queues (not the general app Redis client)
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const jiraSyncQueue = new Queue('jira-sync', { connection });
export const githubSyncQueue = new Queue('github-sync', { connection });
export const metricsQueue = new Queue('compute-metrics', { connection });

export { connection as workerConnection };
