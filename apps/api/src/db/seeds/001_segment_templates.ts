import type { Knex } from 'knex';

// Mirrors the AOMS reference script's SEGMENTS baseline exactly (CLAUDE.md: that script
// is the ground truth for segment definitions) — C:\Users\PaulMensah\Downloads\AOMS\reports\generate_full_report.py
const TEMPLATES = [
  {
    name: 'Delivery',
    description: 'Did this person consistently deliver usable work that aligns with the intended business outcome?',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 1,
  },
  {
    name: 'Collaboration',
    description: 'Did this person contribute positively to team workflow and communicate effectively with both technical and non-technical stakeholders?',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 2,
  },
  {
    name: 'Ownership & Accountability',
    description: 'Does this person take responsibility, proactively manage risks, and contribute beyond assigned tasks to improve outcomes?',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 3,
  },
  {
    name: 'Growth',
    description: 'Is this person improving over time in both technical execution and understanding of the business context?',
    scale_type: 'NUMERIC',
    scale_max: 5,
    enum_values: null,
    display_order: 4,
  },
  {
    name: 'AI Adoption',
    description: 'Is this person proactive and effective in leveraging AI tools to improve their work?',
    scale_type: 'ENUM',
    scale_max: null,
    enum_values: JSON.stringify(['Yes', 'No', 'Unable to assess']),
    display_order: 5,
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex('segment_definition_templates').del();
  await knex('segment_definition_templates').insert(TEMPLATES);
}
