import { z } from 'zod';

export const CreateIntegrationSchema = z.object({
  type: z.enum(['JIRA', 'GITHUB', 'GITLAB', 'LINEAR']),
  config: z.record(z.unknown()),
  // credentials are encrypted before storage — never logged or returned
  credentials: z.record(z.string()),
});

export const UpdateIntegrationSchema = z.object({
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.string()).optional(),
});

// Only JIRA/GITHUB have adapters implemented (Phase 1) — GITLAB/LINEAR are Phase 2 (INT-006/007)
export const TestConnectionSchema = z.object({
  type: z.enum(['JIRA', 'GITHUB']),
  config: z.record(z.unknown()),
  credentials: z.record(z.string()),
});

export type CreateIntegrationInput = z.infer<typeof CreateIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof UpdateIntegrationSchema>;
export type TestConnectionInput = z.infer<typeof TestConnectionSchema>;
