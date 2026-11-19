// An error we throw on purpose. The error handler turns it into
// { error: { code, message, fields? } } with this status. Anything else becomes a generic 500.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// The few errors used in more than one place.
export const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue');

// 404 (not 403) for other users' data too, so nobody can probe which ids exist.
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
