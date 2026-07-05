// Service layer uses plain Error objects with a statusCode property.
// The global error handler in app.ts converts them to RFC 9457 Problem Details.
// This helper keeps the throw sites readable.

export function httpError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

export const NotFound = (msg: string) => httpError(msg, 404);
export const Conflict = (msg: string) => httpError(msg, 409);
export const BadRequest = (msg: string) => httpError(msg, 400);
export const Forbidden = (msg: string) => httpError(msg, 403);
export const Unauthorized = (msg: string) => httpError(msg, 401);
