import ky, { type KyInstance, HTTPError } from 'ky';

// Access token lives here — in module memory only.
// It is never written to localStorage, sessionStorage, or any cookie.
// On a full page reload the token is gone; the app silently calls /refresh
// on boot to restore the session from the httpOnly pb_refresh cookie.
let _accessToken: string | null = null;

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function clearAccessToken(): void {
  _accessToken = null;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// Shared ky instance. All API modules use this — never create a raw ky instance elsewhere.
export const api: KyInstance = ky.create({
  prefixUrl: '/api/v1',
  credentials: 'include', // required so the pb_refresh httpOnly cookie is sent on refresh calls
  hooks: {
    beforeRequest: [
      (request) => {
        if (_accessToken) {
          request.headers.set('Authorization', `Bearer ${_accessToken}`);
        }
      },
    ],
    afterResponse: [
      // Silent 401 → refresh → retry, exactly once.
      // A second 401 after the refresh means the session is truly expired.
      async (request, _options, response) => {
        if (response.status !== 401) return response;

        try {
          const refreshed = await ky.post('/api/v1/auth/refresh', {
            credentials: 'include',
          }).json<{ accessToken: string }>();
          setAccessToken(refreshed.accessToken);
          request.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
          return ky(request);
        } catch {
          clearAccessToken();
          // Redirect to login so the user can re-authenticate
          window.location.href = '/login';
          return response;
        }
      },
    ],
  },
});

// Extracts the RFC 9457 error body from a failed ky request.
// Returns null if the response body is not JSON or not a Problem Details object.
export async function extractApiError(error: unknown): Promise<string> {
  if (error instanceof HTTPError) {
    try {
      const body = await error.response.json() as { detail?: string; title?: string };
      return body.detail ?? body.title ?? error.message;
    } catch {
      return error.message;
    }
  }
  return String(error);
}
