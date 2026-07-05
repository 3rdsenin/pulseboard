import { api } from './client.js';
import type { CreateProjectInput, UpdateProjectInput, AddProjectMemberSchema } from '@pulseboard/shared';
import type { z } from 'zod';
import type { Project } from '../types/index.js';

type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;

interface ProjectMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'PROJECT_ADMIN' | 'PROJECT_VIEWER';
  addedAt: string;
}

export const projectsApi = {
  list: () =>
    api.get('projects').json<Project[]>(),

  get: (projectId: string) =>
    api.get(`projects/${projectId}`).json<Project>(),

  create: (input: CreateProjectInput) =>
    api.post('projects', { json: input }).json<Project>(),

  update: (projectId: string, input: UpdateProjectInput) =>
    api.patch(`projects/${projectId}`, { json: input }).json<Project>(),

  delete: (projectId: string) =>
    api.delete(`projects/${projectId}`),

  listMembers: (projectId: string) =>
    api.get(`projects/${projectId}/members`).json<ProjectMember[]>(),

  addMember: (projectId: string, input: AddProjectMemberInput) =>
    api.post(`projects/${projectId}/members`, { json: input }),

  removeMember: (projectId: string, userId: string) =>
    api.delete(`projects/${projectId}/members/${userId}`),

  updateMemberRole: (
    projectId: string,
    userId: string,
    role: 'PROJECT_ADMIN' | 'PROJECT_VIEWER'
  ) =>
    api.patch(`projects/${projectId}/members/${userId}`, { json: { role } }),
};
