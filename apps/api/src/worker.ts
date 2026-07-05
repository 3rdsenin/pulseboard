import { startJiraWorker } from './workers/jira.worker.js';
import { startGitHubWorker } from './workers/github.worker.js';
import { startMetricsWorker } from './workers/metrics.worker.js';
import { startScheduler } from './workers/scheduler.js';

const jiraWorker = startJiraWorker();
const githubWorker = startGitHubWorker();
const metricsWorker = startMetricsWorker();

// Graceful shutdown: drain in-flight jobs before exiting so no data is lost
async function shutdown() {
  console.log('[worker] shutting down gracefully...');
  await Promise.all([jiraWorker.close(), githubWorker.close(), metricsWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Nightly cron runs inside the worker process so it has direct queue access
await startScheduler();

console.log('[worker] started — jira, github, metrics workers + scheduler active');
