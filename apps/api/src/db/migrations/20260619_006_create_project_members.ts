import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE project_member_role AS ENUM ('PROJECT_ADMIN', 'PROJECT_VIEWER')`);
  await knex.schema.createTable('project_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.specificType('role', 'project_member_role').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable().references('id').inTable('users');
    table.unique(['project_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('project_members');
  await knex.raw(`DROP TYPE IF EXISTS project_member_role`);
}
