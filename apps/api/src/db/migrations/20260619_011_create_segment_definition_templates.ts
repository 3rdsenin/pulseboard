import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('segment_definition_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.text('description').nullable();
    // segment_scale_type enum was created in migration 010
    table.specificType('scale_type', 'segment_scale_type').notNullable();
    table.integer('scale_max').nullable();
    table.jsonb('enum_values').nullable();
    table.integer('display_order').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('segment_definition_templates');
}
