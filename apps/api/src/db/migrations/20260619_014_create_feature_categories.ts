import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('feature_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.specificType('match_patterns', 'TEXT[]').notNullable();
    table.string('color', 7).nullable();
    table.integer('display_order').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.uuid('created_by').nullable().references('id').inTable('users');
  });

  // Add FK from issue_snapshots.feature_category_id now that feature_categories exists
  await knex.schema.alterTable('issue_snapshots', (table) => {
    table.foreign('feature_category_id').references('id').inTable('feature_categories');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('issue_snapshots', (table) => {
    table.dropForeign(['feature_category_id']);
  });
  await knex.schema.dropTableIfExists('feature_categories');
}
