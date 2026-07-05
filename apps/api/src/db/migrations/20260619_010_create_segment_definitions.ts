import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE segment_scale_type AS ENUM ('NUMERIC', 'ENUM')`);
  await knex.schema.createTable('segment_definitions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.text('description').nullable();
    table.specificType('scale_type', 'segment_scale_type').notNullable();
    table.integer('scale_max').nullable();
    table.jsonb('enum_values').nullable();
    table.integer('display_order').notNullable().defaultTo(0);
    table.boolean('is_archived').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.uuid('created_by').nullable().references('id').inTable('users');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('segment_definitions');
  await knex.raw(`DROP TYPE IF EXISTS segment_scale_type`);
}
