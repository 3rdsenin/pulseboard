import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('contributors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.string('display_name', 255).notNullable();
    table.string('email', 255).nullable();
    table.string('jira_account_id').nullable();
    table.string('github_username').nullable();
    table.string('role_label', 100).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.uuid('created_by').nullable().references('id').inTable('users');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contributors');
}
