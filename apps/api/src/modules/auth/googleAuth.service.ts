// Rules for Google sign-in: find the right account, link it, or create a new one.
import { randomBytes } from 'node:crypto';
import type { PublicUser } from '@debrief/shared';
import type { UserRow } from '../../db/schema';
import { hashSessionToken } from '../../lib/crypto';
import { createPkcePair } from '../integrations/googleClient';
import { authRepository } from './auth.repository';
import { startSession, toPublicUser } from './auth.service';
import { GoogleSignInError, type GoogleIdentity, type GoogleSignInClient } from './googleSignIn';

export class GoogleSignInRefused extends Error {
  constructor(readonly reason: 'unverified') {
    super(`Google sign-in refused: ${reason}`);
    this.name = 'GoogleSignInRefused';
  }
}

function fallbackName(email: string) {
  return email.split('@')[0] || 'Debrief user';
}

export function createGoogleAuthService(google: GoogleSignInClient) {
  async function findOrCreateUser(
    identity: GoogleIdentity,
  ): Promise<{ user: UserRow; created: boolean }> {
    const linked = await authRepository.findActiveUserByGoogleSub(identity.sub);
    if (linked) return { user: linked, created: false };

    if (!identity.emailVerified) throw new GoogleSignInRefused('unverified');

    const sameEmail = await authRepository.findActiveUserByEmail(identity.email);
    if (sameEmail) {
      const updated = await authRepository.linkGoogleAccount(sameEmail.id, identity.sub);
      if (updated) return { user: updated, created: false };
    }

    const created = await authRepository.createUser({
      email: identity.email,
      name: identity.name ?? fallbackName(identity.email),
      passwordHash: null,
      googleSub: identity.sub,
    });
    if (created) return { user: created, created: true };

    const raced = await authRepository.findActiveUserByGoogleSub(identity.sub);
    if (raced) return { user: raced, created: false };
    throw new GoogleSignInError('Could not create or find the account');
  }

  return {
    configured: google.configured,

    start() {
      const state = randomBytes(32).toString('base64url');
      const nonce = randomBytes(32).toString('base64url');
      const pkce = createPkcePair();
      return {
        url: google.authUrl({ state, codeChallenge: pkce.challenge, nonce }),
        state,
        nonce,
        verifier: pkce.verifier,
      };
    },

    async finish(
      code: string,
      codeVerifier: string,
      expectedNonce: string,
      previousToken?: string,
    ): Promise<{ user: PublicUser; token: string; created: boolean }> {
      const identity = await google.exchangeCode(code, codeVerifier);
      if (identity.nonce !== expectedNonce) {
        throw new GoogleSignInError('ID token nonce does not match this sign-in');
      }
      const { user, created } = await findOrCreateUser(identity);
      if (previousToken) await authRepository.deleteSession(hashSessionToken(previousToken));
      return { user: toPublicUser(user), token: await startSession(user.id), created };
    },
  };
}

export type GoogleAuthService = ReturnType<typeof createGoogleAuthService>;
