import type { Knex } from 'knex';

// organization_members and project_members were created without deleted_at,
// but every service query and the project-role middleware already filter/write
// on it (soft-delete on member removal) — the column was simply missing.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('organization_members', (table) => {
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });
  await knex.schema.alterTable('project_members', (table) => {
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('organization_members', (table) => {
    table.dropColumn('deleted_at');
  });
  await knex.schema.alterTable('project_members', (table) => {
    table.dropColumn('deleted_at');
  });
}
