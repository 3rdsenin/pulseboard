import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('contributor_ratings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('contributor_id').notNullable()
      .references('id').inTable('contributors').onDelete('CASCADE');
    table.uuid('sprint_id').notNullable()
      .references('id').inTable('sprints').onDelete('CASCADE');
    table.uuid('segment_definition_id').notNullable()
      .references('id').inTable('segment_definitions').onDelete('CASCADE');
    table.jsonb('value').notNullable();
    table.integer('version').notNullable().defaultTo(1);
    table.boolean('is_current').notNullable().defaultTo(true);
    table.text('notes').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable().references('id').inTable('users');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contributor_ratings');
}
