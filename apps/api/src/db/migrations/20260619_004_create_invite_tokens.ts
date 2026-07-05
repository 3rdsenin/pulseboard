import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('invite_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.specificType('role', 'org_member_role').notNullable();
    table.string('token', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('accepted_at', { useTz: true }).nullable();
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('invite_tokens');
}
