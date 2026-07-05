import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').nullable().references('id').inTable('projects');
    table.uuid('user_id').nullable().references('id').inTable('users');
    table.string('action', 100).notNullable();
    table.string('entity_type', 100).notNullable();
    table.uuid('entity_id').notNullable();
    table.jsonb('old_value').nullable();
    table.jsonb('new_value').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  // Append-only — no update or delete on this table
  await knex.raw(`
    CREATE INDEX idx_audit_logs_org_time
    ON audit_logs (organization_id, created_at DESC)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
