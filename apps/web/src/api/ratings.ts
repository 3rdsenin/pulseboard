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
  // Only present on real project segments (GET .../segments) — platform templates
  // (GET /segment-templates) don't have an archived state of their own.
  isArchived?: boolean;
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

  listSegments: (projectId: string, includeArchived = false) =>
    api.get(`projects/${projectId}/segments`, {
      searchParams: { includeArchived: String(includeArchived) }
    }).json<SegmentTemplate[]>(),

  createSegment: (projectId: string, input: CreateSegmentInput) =>
    api.post(`projects/${projectId}/segments`, { json: input }).json<SegmentTemplate>(),

  createFromTemplate: (projectId: string, templateId: string) =>
    api.post(`projects/${projectId}/segments/from-template`, { json: { templateId } }).json<SegmentTemplate>(),

  updateSegment: (projectId: string, segmentId: string, input: UpdateSegmentInput) =>
    api.patch(`projects/${projectId}/segments/${segmentId}`, { json: input }).json<SegmentTemplate>(),

  deleteSegment: (projectId: string, segmentId: string) =>
    api.delete(`projects/${projectId}/segments/${segmentId}`),
};

export interface CreateSegmentInput {
  name: string;
  description?: string;
  scaleType: 'NUMERIC' | 'ENUM';
  scaleMax?: number;
  enumValues?: string[];
  displayOrder?: number;
}

export interface UpdateSegmentInput {
  name?: string;
  description?: string;
  scaleType?: 'NUMERIC' | 'ENUM';
  scaleMax?: number;
  enumValues?: string[];
  displayOrder?: number;
  isArchived?: boolean;
}
