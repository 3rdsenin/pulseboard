import type { Knex } from 'knex';

const TEMPLATES = [
  {
    name: 'Communication',
    description: 'How clearly and proactively the contributor communicates with their team.',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 1,
  },
  {
    name: 'Collaboration',
    description: 'How effectively the contributor works with others, including code reviews and pair sessions.',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 2,
  },
  {
    name: 'Code Quality',
    description: 'The overall quality, readability, and maintainability of the contributor\'s code output.',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 3,
  },
  {
    name: 'Initiative',
    description: 'Whether the contributor proactively identifies and acts on problems or improvements.',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 4,
  },
  {
    name: 'Sprint Reliability',
    description: 'Qualitative assessment of how reliably the contributor delivers on sprint commitments.',
    scale_type: 'ENUM',
    scale_max: null,
    enum_values: JSON.stringify(['Exceeded', 'Met', 'Mostly Met', 'Fell Short']),
    display_order: 5,
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex('segment_definition_templates').del();
  await knex('segment_definition_templates').insert(TEMPLATES);
}
