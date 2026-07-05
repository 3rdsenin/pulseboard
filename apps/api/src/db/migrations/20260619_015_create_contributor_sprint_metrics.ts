import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('contributor_sprint_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('contributor_id').notNullable()
      .references('id').inTable('contributors').onDelete('CASCADE');
    table.uuid('sprint_id').notNullable()
      .references('id').inTable('sprints').onDelete('CASCADE');
    table.integer('issues_total').notNullable().defaultTo(0);
    table.integer('issues_done').notNullable().defaultTo(0);
    table.integer('issues_high_priority').notNullable().defaultTo(0);
    table.integer('issues_in_progress').notNullable().defaultTo(0);
    table.integer('commit_count').notNullable().defaultTo(0);
    table.specificType('repos_contributed', 'TEXT[]').notNullable().defaultTo('{}');
    table.date('last_commit_date').nullable();
    table.decimal('delivery_score', 4, 2).nullable();
    table.decimal('volume_score', 4, 2).nullable();
    table.decimal('high_priority_score', 4, 2).nullable();
    table.decimal('weighted_score', 4, 2).nullable();
    table.integer('sprint_rank').nullable();
    table.timestamp('computed_at', { useTz: true }).nullable();
    table.unique(['project_id', 'contributor_id', 'sprint_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contributor_sprint_metrics');
}
