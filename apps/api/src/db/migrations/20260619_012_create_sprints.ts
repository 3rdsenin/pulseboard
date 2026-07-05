import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE sprint_state AS ENUM ('ACTIVE', 'CLOSED', 'FUTURE')`);
  await knex.schema.createTable('sprints', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.string('external_id').notNullable();
    table.string('name', 255).notNullable();
    table.specificType('state', 'sprint_state').notNullable();
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    table.date('complete_date').nullable();
    table.text('goal').nullable();
    table.timestamp('synced_at', { useTz: true }).notNullable();
    table.unique(['project_id', 'external_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sprints');
  await knex.raw(`DROP TYPE IF EXISTS sprint_state`);
}
