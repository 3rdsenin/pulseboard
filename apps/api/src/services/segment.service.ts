import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

interface CreateSegmentInput {
  name: string;
  description?: string;
  scaleType: 'NUMERIC' | 'ENUM';
  scaleMax?: number;
  enumValues?: string[];
  displayOrder?: number;
}

interface UpdateSegmentInput {
  name?: string;
  description?: string;
  scaleMax?: number;
  enumValues?: string[];
  displayOrder?: number;
  isArchived?: boolean;
}

export class SegmentService {
  async listSegments(organizationId: string, projectId: string, includeArchived = false) {
    const query = db('segment_definitions')
      .where({ organization_id: organizationId, project_id: projectId, deleted_at: null });

    if (!includeArchived) {
      query.where({ is_archived: false });
    }

    return query
      .orderBy('display_order', 'asc')
      .select(
        'id', 'name', 'description',
        'scale_type as scaleType', 'scale_max as scaleMax', 'enum_values as enumValues',
        'display_order as displayOrder', 'is_archived as isArchived', 'created_at as createdAt'
      );
  }

  async createSegment(
    organizationId: string,
    projectId: string,
    input: CreateSegmentInput,
    actorId: string
  ) {
    const [segment] = await db('segment_definitions')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        name: input.name,
        description: input.description ?? null,
        scale_type: input.scaleType,
        scale_max: input.scaleMax ?? null,
        enum_values: input.enumValues ? JSON.stringify(input.enumValues) : null,
        display_order: input.displayOrder ?? 0,
        created_by: actorId,
      })
      .returning([
        'id', 'name', 'description',
        'scale_type as scaleType', 'scale_max as scaleMax', 'enum_values as enumValues',
        'display_order as displayOrder', 'created_at as createdAt',
      ]);

    return segment;
  }

  async updateSegment(
    organizationId: string,
    projectId: string,
    segmentId: string,
    input: UpdateSegmentInput
  ) {
    const updates: Record<string, unknown> = { updated_at: db.fn.now() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.scaleMax !== undefined) updates.scale_max = input.scaleMax;
    if (input.enumValues !== undefined) updates.enum_values = JSON.stringify(input.enumValues);
    if (input.displayOrder !== undefined) updates.display_order = input.displayOrder;
    if (input.isArchived !== undefined) updates.is_archived = input.isArchived;

    const [updated] = await db('segment_definitions')
      .where({ id: segmentId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .update(updates)
      .returning([
        'id', 'name', 'description',
        'scale_type as scaleType', 'scale_max as scaleMax', 'enum_values as enumValues',
        'display_order as displayOrder', 'is_archived as isArchived',
      ]);

    return updated ?? null;
  }

  async deleteSegment(organizationId: string, projectId: string, segmentId: string) {
    // Check no ratings exist for this segment before deleting — deleting a
    // segment with ratings would orphan rating history that can't be re-displayed
    const ratingCount = await db('contributor_ratings')
      .where({ segment_definition_id: segmentId, is_current: true })
      .count('id as count')
      .first();

    if (Number(ratingCount?.count ?? 0) > 0) {
      throw Object.assign(
        new Error('Cannot delete a segment that has existing ratings. Archive it instead.'),
        { statusCode: 409 }
      );
    }

    const affected = await db('segment_definitions')
      .where({ id: segmentId, organization_id: organizationId, project_id: projectId, deleted_at: null })
      .update({ deleted_at: db.fn.now() });

    if (!affected) {
      throw Object.assign(new Error('Segment not found'), { statusCode: 404 });
    }
  }

  // Platform-level templates — any org can use these as a starting point
  async listTemplates() {
    return db('segment_definition_templates')
      .orderBy('display_order', 'asc')
      .select(
        'id', 'name', 'description',
        'scale_type as scaleType', 'scale_max as scaleMax', 'enum_values as enumValues',
        'display_order as displayOrder'
      );
  }

  // Creates project segments from a template, skipping any already present by name
  async createFromTemplate(
    organizationId: string,
    projectId: string,
    templateId: string,
    actorId: string
  ) {
    // enum_values is a jsonb column — `pg` already parses it into a JS array, so passing
    // it through JSON.parse() (as this used to) throws on any ENUM-scale template, since
    // JSON.parse expects a string, not an array.
    const template = await db('segment_definition_templates')
      .where({ id: templateId })
      .first(
        'id', 'name', 'description',
        'scale_type as scaleType', 'scale_max as scaleMax', 'enum_values as enumValues',
        'display_order as displayOrder'
      );
    if (!template) throw Object.assign(new Error('Template not found'), { statusCode: 404 });

    const existing = await db('segment_definitions')
      .where({ organization_id: organizationId, project_id: projectId, name: template.name, deleted_at: null })
      .first('id');

    if (existing) {
      throw Object.assign(new Error(`A segment named "${template.name}" already exists in this project`), { statusCode: 409 });
    }

    return this.createSegment(organizationId, projectId, {
      name: template.name,
      description: template.description,
      scaleType: template.scaleType,
      scaleMax: template.scaleMax,
      enumValues: template.enumValues ?? undefined,
      displayOrder: template.displayOrder,
    }, actorId);
  }
}
