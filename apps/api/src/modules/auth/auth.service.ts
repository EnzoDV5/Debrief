// Accounts and sessions: argon2id passwords, fresh session on every login, soft delete.
import type {
  DeleteAccountInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  UpdateProfileInput,
} from '@debrief/shared';
import argon2 from 'argon2';
import type { UserRow } from '../../db/schema';
import { generateSessionToken, hashSessionToken } from '../../lib/crypto';
import { AppError, unauthenticated } from '../../lib/errors';
import { detectImageType } from '../../lib/imageType';
import { authRepository } from './auth.repository';
import { SESSION_TTL_MS } from './sessionCookie';

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

// Checked even when the email doesn't exist, so response times don't reveal which emails have accounts.
const dummyHash = hashPassword('timing-equaliser-not-a-real-password');

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

// Where the browser loads an uploaded photo from. The ?v= changes with every upload, so the photo
// can be cached for a long time and a new one still shows straight away.
export const UPLOADED_AVATAR_PATH = '/api/auth/me/avatar';

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    hasPassword: user.passwordHash !== null,
    avatarUrl: user.avatarUpdatedAt
      ? `${UPLOADED_AVATAR_PATH}?v=${user.avatarUpdatedAt.getTime()}`
      : user.googleAvatarUrl,
    hasUploadedAvatar: user.avatarUpdatedAt !== null,
  };
}

const notAnImage = () => {
  const message = 'That file isn’t a JPEG, PNG or WebP photo';
  return new AppError(400, 'INVALID_IMAGE', message, { file: message });
};

export async function startSession(userId: string): Promise<string> {
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

  async login(input: LoginInput, previousToken?: string) {
    const user = await authRepository.findActiveUserByEmail(input.email);
    const passwordOk = user?.passwordHash
      ? await argon2.verify(user.passwordHash, input.password)
      : await argon2.verify(await dummyHash, input.password).then(() => false);
    if (!user || !passwordOk) throw invalidCredentials();

    if (previousToken) await authRepository.deleteSession(hashSessionToken(previousToken));
    return { user: toPublicUser(user), token: await startSession(user.id) };
  },

  async logout(token: string) {
    await authRepository.deleteSession(hashSessionToken(token));
  },

  async getSession(token: string) {
    const tokenHash = hashSessionToken(token);
    const user = await authRepository.findUserBySession(tokenHash);
    return user ? { user: toPublicUser(user), tokenHash } : null;
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await authRepository.updateName(userId, input.name);
    if (!user) throw unauthenticated();
    return toPublicUser(user);
  },

  async uploadAvatar(userId: string, file: Buffer | undefined): Promise<PublicUser> {
    const contentType = file ? detectImageType(file) : null;
    if (!file || !contentType) throw notAnImage();
    const user = await authRepository.saveUploadedAvatar(userId, contentType, file);
    if (!user) throw unauthenticated();
    return toPublicUser(user);
  },

  async getUploadedAvatar(userId: string) {
    const avatar = await authRepository.findUploadedAvatar(userId);
    if (!avatar) throw new AppError(404, 'NOT_FOUND', 'No uploaded photo');
    return avatar;
  },

  async removeAvatar(userId: string): Promise<PublicUser> {
    const user = await authRepository.removeUploadedAvatar(userId);
    if (!user) throw unauthenticated();
    return toPublicUser(user);
  },

  async deleteAccount(userId: string, input: DeleteAccountInput) {
    const user = await authRepository.findActiveUserById(userId);
    if (!user) throw unauthenticated();
    if (user.passwordHash) {
      const ok = 'password' in input && (await argon2.verify(user.passwordHash, input.password));
      if (!ok) {
        const message = 'Password is incorrect';
        throw new AppError(400, 'INCORRECT_PASSWORD', message, { password: message });
      }
    } else if (!('email' in input) || input.email !== user.email) {
      const message = 'That isn’t the email for this account';
      throw new AppError(400, 'INCORRECT_EMAIL', message, { email: message });
    }
    await authRepository.softDeleteUser(userId);
  },
};
