import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('contributor_name_aliases', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('contributor_id').notNullable()
      .references('id').inTable('contributors').onDelete('CASCADE');
    table.string('alias', 255).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable().references('id').inTable('users');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contributor_name_aliases');
}
