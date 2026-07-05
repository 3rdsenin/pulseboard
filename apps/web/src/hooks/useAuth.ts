import { create } from 'zustand';
import { authApi } from '../api/auth.js';
import { setAccessToken, clearAccessToken } from '../api/client.js';
import type { User } from '../types/index.js';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialising: boolean;
  // Called on app boot — attempts silent refresh from pb_refresh cookie
  initialise: () => Promise<void>;
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialising: true,

  initialise: async () => {
    try {
      const result = await authApi.refresh();
      if (result) {
        // We have a valid refresh token — but we don't know the user's profile
        // yet. The access token payload contains userId and organizationId;
        // decode it (no verification needed here — that happens server-side)
        // to populate the store without an extra round-trip.
        setAccessToken(result.accessToken);
        const payload = JSON.parse(atob(result.accessToken.split('.')[1]!)) as {
          sub: string;
          email: string;
          organizationId: string;
          orgRole: 'ORG_ADMIN' | 'ORG_MEMBER';
        };
        set({
          isAuthenticated: true,
          user: {
            userId: payload.sub,
            email: payload.email,
            name: '', // populated on first full org/user fetch
            organizationId: payload.organizationId,
            orgRole: payload.orgRole,
          },
        });
      }
    } catch {
      // No valid refresh token — user will be sent to /login
      clearAccessToken();
    } finally {
      set({ isInitialising: false });
    }
  },

  login: (accessToken, user) => {
    setAccessToken(accessToken);
    set({ isAuthenticated: true, user });
  },

  logout: async () => {
    await authApi.logout();
    clearAccessToken();
    set({ isAuthenticated: false, user: null });
  },
}));
