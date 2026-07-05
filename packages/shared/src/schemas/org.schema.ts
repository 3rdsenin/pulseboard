import { z } from 'zod';

export const OrgPlanSchema = z.enum(['FREE', 'PRO', 'ENTERPRISE']);

export const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ORG_ADMIN', 'ORG_MEMBER']),
});

export const AcceptInviteSchema = z.object({
  token: z.string().min(1),
});

export type OrgPlan = z.infer<typeof OrgPlanSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
