import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('issue_snapshots', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('sprint_id').nullable().references('id').inTable('sprints');
    table.string('external_key').notNullable();
    table.text('summary').notNullable();
    table.string('status', 100).notNullable();
    table.string('issue_type', 100).notNullable();
    table.string('priority', 50).nullable();
    table.uuid('assignee_contributor_id').nullable().references('id').inTable('contributors');
    table.specificType('labels', 'TEXT[]').notNullable().defaultTo('{}');
    // feature_category_id FK is added in migration 014 after feature_categories is created
    table.uuid('feature_category_id').nullable();
    table.jsonb('raw_payload').nullable();
    table.date('created_date').nullable();
    table.date('updated_date').nullable();
    table.timestamp('synced_at', { useTz: true }).notNullable();
    table.unique(['project_id', 'external_key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('issue_snapshots');
}
