import { api } from './client.js';
import type { RegisterInput, LoginInput } from '@pulseboard/shared';

interface AuthResponse {
  accessToken: string;
  userId: string;
  organizationId: string;
}

export const authApi = {
  register: (input: RegisterInput) =>
    api.post('auth/register', { json: input }).json<AuthResponse>(),

  login: (input: LoginInput) =>
    api.post('auth/login', { json: input }).json<AuthResponse>(),

  // Called on app boot to restore session from the pb_refresh cookie.
  // Returns null if no valid refresh token exists (user must log in).
  refresh: () =>
    api.post('auth/refresh').json<{ accessToken: string }>().catch(() => null),

  logout: () =>
    api.post('auth/logout').json<{ ok: boolean }>().catch(() => null),

  getMe: () =>
    api.get('auth/me').json<{ id: string; name: string; email: string; githubUsername: string | null }>(),

  updateMe: (input: { name?: string; githubUsername?: string | null }) =>
    api.patch('auth/me', { json: input }).json<{ id: string; name: string; email: string; githubUsername: string | null }>(),

  // Every org the caller belongs to — used to show an org switcher when there's more than one.
  listOrganizations: () =>
    api.get('auth/organizations').json<Array<{ organizationId: string; name: string; orgRole: 'ORG_ADMIN' | 'ORG_MEMBER' }>>(),

  // Reissues a token scoped to a different membership (see AuthService.switchOrganization).
  switchOrg: (organizationId: string) =>
    api.post('auth/switch-org', { json: { organizationId } }).json<{
      accessToken: string;
      organizationId: string;
      orgRole: 'ORG_ADMIN' | 'ORG_MEMBER';
    }>(),
};
