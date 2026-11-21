// Tells TypeScript about the user that requireAuth puts on the request.
import type { PublicUser } from '@debrief/shared';

declare module 'express-serve-static-core' {
  interface Request {
    user?: PublicUser;
    sessionTokenHash?: string;
  }
}
