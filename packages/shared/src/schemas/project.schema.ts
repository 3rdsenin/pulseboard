import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(2).max(63).regex(/^[a-z0-9-]+$/),
  syncCron: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  syncCron: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const AddProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['PROJECT_ADMIN', 'PROJECT_VIEWER']),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
