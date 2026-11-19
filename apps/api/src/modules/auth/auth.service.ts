import type { DeleteAccountInput, LoginInput, PublicUser, RegisterInput } from '@debrief/shared';
import argon2 from 'argon2';
import type { UserRow } from '../../db/schema';
import { generateSessionToken, hashSessionToken } from '../../lib/crypto';
import { AppError, unauthenticated } from '../../lib/errors';
import { authRepository } from './auth.repository';
import { SESSION_TTL_MS } from './sessionCookie';

// Business rules for accounts and sessions. No req/res here, and no SQL (that's the repository).

// argon2id: memory-hard, so guessing passwords on GPUs is slow and expensive. The library's
// defaults (64 MiB, 3 passes) follow the OWASP recommendation.
const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

// Used when the email doesn't exist, so a failed login takes the same time either way.
// Without it, a fast "no such user" response would reveal which emails have accounts.
const dummyHash = hashPassword('timing-equaliser-not-a-real-password');

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Creates a session and returns the raw token for the cookie. Only its hash is stored. */
async function startSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  await authRepository.createSession({
    id: hashSessionToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export const authService = {
  async register(input: RegisterInput) {
    const user = await authRepository.createUser({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    });
    if (!user) {
      const message = 'An account with this email already exists';
      throw new AppError(409, 'EMAIL_TAKEN', message, { email: message });
    }
    return { user: toPublicUser(user), token: await startSession(user.id) };
  },

  /** `previousToken`: a session cookie the browser already had. It's ended, never reused. */
  async login(input: LoginInput, previousToken?: string) {
    const user = await authRepository.findActiveUserByEmail(input.email);
    const passwordOk = user
      ? await argon2.verify(user.passwordHash, input.password)
      : await argon2.verify(await dummyHash, input.password).then(() => false);
    if (!user || !passwordOk) throw invalidCredentials();

    // Always issue a brand-new session on login (prevents session fixation).
    if (previousToken) await authRepository.deleteSession(hashSessionToken(previousToken));
    return { user: toPublicUser(user), token: await startSession(user.id) };
  },

  async logout(token: string) {
    await authRepository.deleteSession(hashSessionToken(token));
  },

  /** Resolves a cookie token to its user, or null if the session is missing/expired/deleted. */
  async getSession(token: string) {
    const tokenHash = hashSessionToken(token);
    const user = await authRepository.findUserBySession(tokenHash);
    return user ? { user: toPublicUser(user), tokenHash } : null;
  },

  async deleteAccount(userId: string, input: DeleteAccountInput) {
    const user = await authRepository.findActiveUserById(userId);
    if (!user) throw unauthenticated();
    if (!(await argon2.verify(user.passwordHash, input.password))) {
      const message = 'Password is incorrect';
      throw new AppError(400, 'INCORRECT_PASSWORD', message, { password: message });
    }
    await authRepository.softDeleteUser(userId);
  },
};
