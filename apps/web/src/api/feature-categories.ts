import { api } from './client.js';

export interface FeatureCategory {
  id: string;
  name: string;
  matchPatterns: string[];
  color: string | null;
  displayOrder: number;
  createdAt: string;
}

export const featureCategoriesApi = {
  list: (projectId: string) =>
    api.get(`projects/${projectId}/feature-categories`).json<FeatureCategory[]>( ),

  create: (projectId: string, input: { name: string; matchPatterns: string[]; color?: string }) =>
    api.post(`projects/${projectId}/feature-categories`, { json: input }).json<FeatureCategory>(),

  update: (projectId: string, categoryId: string, input: { name?: string; matchPatterns?: string[]; color?: string }) =>
    api.patch(`projects/${projectId}/feature-categories/${categoryId}`, { json: input }).json<FeatureCategory>(),

  delete: (projectId: string, categoryId: string) =>
    api.delete(`projects/${projectId}/feature-categories/${categoryId}`),

  reorder: (projectId: string, order: string[]) =>
    api.post(`projects/${projectId}/feature-categories/reorder`, { json: { order } }),
};
