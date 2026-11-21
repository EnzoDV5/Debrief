// Errors we throw on purpose, each with a status and code the error handler can send back.
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

export const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue');

export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
