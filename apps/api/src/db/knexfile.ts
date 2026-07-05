import type { Knex } from 'knex';

const base: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: Number(process.env.DATABASE_POOL_MIN ?? 2),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
    // Knex loads migration files alphabetically by filename. The YYYYMMDD_ prefix
    // guarantees the correct order regardless of how files are added later.
    loadExtensions: ['.ts'],
  },
  seeds: {
    directory: './seeds',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

// Named environments let db/index.ts select the right config for NODE_ENV
const config: Record<string, Knex.Config> = {
  development: base,
  test: {
    ...base,
    connection: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
  },
  production: {
    ...base,
    pool: {
      min: Number(process.env.DATABASE_POOL_MIN ?? 2),
      max: Number(process.env.DATABASE_POOL_MAX ?? 20),
    },
  },
};

export default config;
