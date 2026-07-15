import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
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
