import type { PublicUser } from '@debrief/shared';

// Adds the fields our requireAuth middleware sets, so controllers get them fully typed.
declare module 'express-serve-static-core' {
  interface Request {
    /** The logged-in user. Set by requireAuth; use getAuthUser(req) to read it. */
    user?: PublicUser;
    /** Hash of the current session token, so logout can delete exactly this session. */
    sessionTokenHash?: string;
  }
}
