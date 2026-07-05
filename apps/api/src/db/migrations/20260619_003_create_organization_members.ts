import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE org_member_role AS ENUM ('ORG_ADMIN', 'ORG_MEMBER')`);
  await knex.schema.createTable('organization_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.specificType('role', 'org_member_role').notNullable();
    table.uuid('invited_by').nullable().references('id').inTable('users');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['organization_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('organization_members');
  await knex.raw(`DROP TYPE IF EXISTS org_member_role`);
}
