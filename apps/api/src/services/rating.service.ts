import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

interface UpsertRatingInput {
  segmentDefinitionId: string;
  value: unknown;
  notes?: string;
}

export class RatingService {
  async getSprintRatings(organizationId: string, projectId: string, sprintId: string) {
    return db('contributor_ratings as cr')
      .join('segment_definitions as sd', 'sd.id', 'cr.segment_definition_id')
      .join('contributors as c', 'c.id', 'cr.contributor_id')
      .where({
        'cr.organization_id': organizationId,
        'cr.project_id': projectId,
        'cr.sprint_id': sprintId,
        'cr.is_current': true,
      })
      .select(
        'cr.id',
        'cr.contributor_id as contributorId',
        'c.display_name as contributorName',
        'cr.segment_definition_id as segmentDefinitionId',
        'sd.name as segmentName',
        'sd.scale_type as scaleType',
        'sd.scale_max as scaleMax',
        'sd.enum_values as enumValues',
        'cr.value',
        'cr.version',
        'cr.notes',
        'cr.created_at as createdAt'
      );
  }

  async upsertRating(
    organizationId: string,
    projectId: string,
    sprintId: string,
    contributorId: string,
    input: UpsertRatingInput,
    actorId: string
  ) {
    // Versioned rating: mark the previous entry no longer current, then insert a new one.
    // This preserves history for audit — deleted_at would lose the version trail.
    await db.transaction(async (trx) => {
      await trx('contributor_ratings')
        .where({
          organization_id: organizationId,
          project_id: projectId,
          sprint_id: sprintId,
          contributor_id: contributorId,
          segment_definition_id: input.segmentDefinitionId,
          is_current: true,
        })
        .update({ is_current: false });

      const existing = await trx('contributor_ratings')
        .where({
          organization_id: organizationId,
          project_id: projectId,
          sprint_id: sprintId,
          contributor_id: contributorId,
          segment_definition_id: input.segmentDefinitionId,
        })
        .max('version as max')
        .first();

      const nextVersion = Number(existing?.max ?? 0) + 1;

      await trx('contributor_ratings').insert({
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        sprint_id: sprintId,
        contributor_id: contributorId,
        segment_definition_id: input.segmentDefinitionId,
        value: JSON.stringify(input.value),
        version: nextVersion,
        is_current: true,
        notes: input.notes ?? null,
        created_by: actorId,
      });
    });
  }

  async deleteRating(
    organizationId: string,
    projectId: string,
    sprintId: string,
    contributorId: string,
    segmentDefinitionId: string
  ) {
    // Soft-delete by clearing is_current — history is preserved
    const affected = await db('contributor_ratings')
      .where({
        organization_id: organizationId,
        project_id: projectId,
        sprint_id: sprintId,
        contributor_id: contributorId,
        segment_definition_id: segmentDefinitionId,
        is_current: true,
      })
      .update({ is_current: false });

    if (!affected) {
      throw Object.assign(new Error('Rating not found'), { statusCode: 404 });
    }
  }
}
