import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

interface CreateCategoryInput {
  name: string;
  matchPatterns: string[];
  color?: string;
  displayOrder?: number;
}

interface UpdateCategoryInput {
  name?: string;
  matchPatterns?: string[];
  color?: string;
  displayOrder?: number;
  isArchived?: boolean;
}

export class FeatureCategoryService {
  async listCategories(organizationId: string, projectId: string) {
    return db('feature_categories')
      .where({
        organization_id: organizationId,
        project_id: projectId,
        deleted_at: null,
      })
      .orderBy('display_order', 'asc')
      .select(
        'id',
        'name',
        'match_patterns as matchPatterns',
        'color',
        'display_order as displayOrder',
        'created_at as createdAt'
      );
  }

  async getCategory(organizationId: string, projectId: string, categoryId: string) {
    return db('feature_categories')
      .where({
        id: categoryId,
        organization_id: organizationId,
        project_id: projectId,
        deleted_at: null,
      })
      .first(
        'id',
        'name',
        'match_patterns as matchPatterns',
        'color',
        'display_order as displayOrder',
        'created_at as createdAt'
      );
  }

  async createCategory(
    organizationId: string,
    projectId: string,
    input: CreateCategoryInput,
    actorId: string
  ) {
    let displayOrder = input.displayOrder;
    if (displayOrder === undefined) {
      const maxRow = await db('feature_categories')
        .where({ organization_id: organizationId, project_id: projectId, deleted_at: null })
        .max('display_order as max')
        .first();
      displayOrder = (Number(maxRow?.max) || 0) + 1;
    }

    const [category] = await db('feature_categories')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        project_id: projectId,
        name: input.name,
        match_patterns: db.raw('?::TEXT[]', [input.matchPatterns]),
        color: input.color ?? null,
        display_order: displayOrder,
        created_by: actorId,
      })
      .returning([
        'id',
        'name',
        'match_patterns as matchPatterns',
        'color',
        'display_order as displayOrder',
        'created_at as createdAt',
      ]);

    return category;
  }

  async updateCategory(
    organizationId: string,
    projectId: string,
    categoryId: string,
    input: UpdateCategoryInput
  ) {
    const updates: Record<string, unknown> = { updated_at: db.fn.now() };

    if (input.name !== undefined) updates.name = input.name;
    if (input.matchPatterns !== undefined) {
      updates.match_patterns = db.raw('?::TEXT[]', [input.matchPatterns]);
    }
    if (input.color !== undefined) updates.color = input.color;
    if (input.displayOrder !== undefined) updates.display_order = input.displayOrder;

    const [updated] = await db('feature_categories')
      .where({
        id: categoryId,
        organization_id: organizationId,
        project_id: projectId,
        deleted_at: null,
      })
      .update(updates)
      .returning([
        'id',
        'name',
        'match_patterns as matchPatterns',
        'color',
        'display_order as displayOrder',
        'created_at as createdAt',
      ]);

    return updated ?? null;
  }

  async deleteCategory(organizationId: string, projectId: string, categoryId: string) {
    const affected = await db('feature_categories')
      .where({
        id: categoryId,
        organization_id: organizationId,
        project_id: projectId,
        deleted_at: null,
      })
      .update({ deleted_at: db.fn.now() });

    if (!affected) {
      throw Object.assign(new Error('Feature category not found'), { statusCode: 404 });
    }
  }

  async reorderCategories(organizationId: string, projectId: string, order: string[]) {
    await db.transaction(async (trx) => {
      for (let i = 0; i < order.length; i++) {
        await trx('feature_categories')
          .where({
            id: order[i],
            organization_id: organizationId,
            project_id: projectId,
            deleted_at: null,
          })
          .update({ display_order: i + 1, updated_at: db.fn.now() });
      }
    });
  }
}
