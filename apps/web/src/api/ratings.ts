import { api } from './client.js';

export interface Rating {
  id: string;
  contributorId: string;
  contributorName: string;
  segmentDefinitionId: string;
  segmentName: string;
  scaleType: 'NUMERIC' | 'ENUM';
  scaleMax: number | null;
  enumValues: string[] | null;
  value: unknown;
  version: number;
  notes: string | null;
  createdAt: string;
}

export interface SegmentTemplate {
  id: string;
  name: string;
  description: string | null;
  scaleType: 'NUMERIC' | 'ENUM';
  scaleMax: number | null;
  enumValues: string[] | null;
  displayOrder: number;
}

export const ratingsApi = {
  getSprintRatings: (projectId: string, sprintId: string) =>
    api.get(`projects/${projectId}/sprints/${sprintId}/ratings`).json<Rating[]>(),

  upsertRating: (
    projectId: string,
    sprintId: string,
    contributorId: string,
    segmentDefinitionId: string,
    value: unknown,
    notes?: string
  ) =>
    api.post(`projects/${projectId}/sprints/${sprintId}/contributors/${contributorId}/ratings`, {
      json: { segmentDefinitionId, value, notes },
    }),

  deleteRating: (
    projectId: string,
    sprintId: string,
    contributorId: string,
    segmentId: string
  ) =>
    api.delete(`projects/${projectId}/sprints/${sprintId}/contributors/${contributorId}/ratings/${segmentId}`),

  listTemplates: () =>
    api.get('segment-templates').json<SegmentTemplate[]>(),

  listSegments: (projectId: string) =>
    api.get(`projects/${projectId}/segments`).json<SegmentTemplate[]>(),
};
