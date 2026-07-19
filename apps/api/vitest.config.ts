import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // All integration tests share one real Postgres database (no mocks — see
    // feedback_verification_first) and each file's beforeEach truncates organizations/users.
    // Running test files in parallel lets one file's cleanup wipe another file's
    // in-progress fixtures mid-test. Serial execution trades some speed for determinism.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://pulseboard:changeme@localhost:5432/pulseboard_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-access-secret-not-for-production-0000000000000000',
      JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-production-000000000000000',
      JWT_ACCESS_EXPIRY: '15m',
      JWT_REFRESH_EXPIRY: '7d',
      ENCRYPTION_KEY: '0'.repeat(64),
      FRONTEND_URL: 'http://localhost:5173',
    },
  },
});
