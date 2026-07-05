import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE integration_type AS ENUM ('JIRA', 'GITHUB', 'GITLAB', 'LINEAR')`);
  await knex.raw(`CREATE TYPE integration_status AS ENUM ('ACTIVE', 'ERROR', 'PAUSED')`);
  await knex.schema.createTable('integrations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.specificType('type', 'integration_type').notNullable();
    table.jsonb('config').notNullable();
    table.text('credentials_encrypted').notNullable();
    table.specificType('status', 'integration_status').notNullable().defaultTo('ACTIVE');
    table.timestamp('last_tested_at', { useTz: true }).nullable();
    table.text('last_error').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.uuid('created_by').nullable().references('id').inTable('users');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('integrations');
  await knex.raw(`DROP TYPE IF EXISTS integration_status`);
  await knex.raw(`DROP TYPE IF EXISTS integration_type`);
}
