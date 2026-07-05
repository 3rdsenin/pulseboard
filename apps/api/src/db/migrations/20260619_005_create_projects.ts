import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('slug', 100).notNullable();
    table.string('sync_cron', 50).notNullable().defaultTo('0 2 * * *');
    table.timestamp('last_synced_at', { useTz: true }).nullable();
    table.jsonb('settings').notNullable().defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.uuid('created_by').nullable().references('id').inTable('users');
    table.unique(['organization_id', 'slug']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('projects');
}
