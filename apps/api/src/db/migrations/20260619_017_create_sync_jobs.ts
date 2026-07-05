import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE sync_job_type AS ENUM ('JIRA_SYNC', 'GITHUB_SYNC', 'COMPUTE_METRICS', 'FULL_SYNC')`);
  await knex.raw(`CREATE TYPE sync_job_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')`);
  await knex.raw(`CREATE TYPE sync_trigger AS ENUM ('SCHEDULE', 'MANUAL')`);
  await knex.schema.createTable('sync_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.specificType('type', 'sync_job_type').notNullable();
    table.specificType('status', 'sync_job_status').notNullable().defaultTo('PENDING');
    table.specificType('triggered_by', 'sync_trigger').notNullable();
    table.uuid('triggered_by_user_id').nullable().references('id').inTable('users');
    table.timestamp('started_at', { useTz: true }).nullable();
    table.timestamp('completed_at', { useTz: true }).nullable();
    table.integer('records_processed').nullable();
    table.text('error_message').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sync_jobs');
  await knex.raw(`DROP TYPE IF EXISTS sync_trigger`);
  await knex.raw(`DROP TYPE IF EXISTS sync_job_status`);
  await knex.raw(`DROP TYPE IF EXISTS sync_job_type`);
}
