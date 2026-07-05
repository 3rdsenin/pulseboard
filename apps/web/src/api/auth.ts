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
};
