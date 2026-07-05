import { api } from './client.js';

interface OrgMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'ORG_ADMIN' | 'ORG_MEMBER';
  joinedAt: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
}

export const orgsApi = {
  getMyOrg: () =>
    api.get('orgs/me').json<Org>(),

  updateMyOrg: (name: string) =>
    api.patch('orgs/me', { json: { name } }).json<Org>(),

  listMembers: () =>
    api.get('orgs/me/members').json<OrgMember[]>(),

  removeMember: (userId: string) =>
    api.delete(`orgs/me/members/${userId}`),

  inviteMember: (email: string, role: 'ORG_ADMIN' | 'ORG_MEMBER') =>
    api.post('orgs/me/invites', { json: { email, role } }).json<{ token: string; expiresAt: string }>(),

  acceptInvite: (token: string) =>
    api.post('orgs/invites/accept', { json: { token } }).json<{ organizationId: string }>(),
};
