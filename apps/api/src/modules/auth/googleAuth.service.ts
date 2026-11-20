import { randomBytes } from 'node:crypto';
import type { PublicUser } from '@debrief/shared';
import type { UserRow } from '../../db/schema';
import { hashSessionToken } from '../../lib/crypto';
import { createPkcePair } from '../integrations/googleClient';
import { authRepository } from './auth.repository';
import { startSession, toPublicUser } from './auth.service';
import { GoogleSignInError, type GoogleIdentity, type GoogleSignInClient } from './googleSignIn';

// Business rules for Sign in with Google. No req/res, no SQL (that's the repository).

/** Why sign-in can't go ahead; the controller turns it into a message on the login page. */
export class GoogleSignInRefused extends Error {
  constructor(readonly reason: 'unverified') {
    super(`Google sign-in refused: ${reason}`);
    this.name = 'GoogleSignInRefused';
  }
}

/** A name for a new account when Google doesn't share one: the part of the email before the @. */
function fallbackName(email: string) {
  return email.split('@')[0] || 'Debrief user';
}

export function createGoogleAuthService(google: GoogleSignInClient) {
  /**
   * The account this Google identity belongs to, in order:
   *   1. the account already linked to this Google id,
   *   2. an existing account with the same (Google-verified) email, which gets linked now,
   *   3. a brand-new account with no password.
   */
  async function findOrCreateUser(
    identity: GoogleIdentity,
  ): Promise<{ user: UserRow; created: boolean }> {
    const linked = await authRepository.findActiveUserByGoogleSub(identity.sub);
    if (linked) return { user: linked, created: false };

    // Only trust the email if Google has checked the person owns it. Otherwise anyone could
    // make a Google account with someone else's address and walk into their Debrief account.
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

    // Lost a race: the same person finished signing in in another tab a moment ago, so the
    // account exists now. Use it rather than failing.
    const raced = await authRepository.findActiveUserByGoogleSub(identity.sub);
    if (raced) return { user: raced, created: false };
    throw new GoogleSignInError('Could not create or find the account');
  }

  return {
    configured: google.configured,

    /**
     * Step 1: where to send the user, plus the secrets the browser must keep until Google sends
     * them back: `state` (stops another site finishing a sign-in in this browser, i.e. CSRF),
     * the PKCE verifier (makes an intercepted code useless) and `nonce` (ties the ID token to
     * this attempt, so an old token can't be replayed).
     */
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

    /**
     * Step 2, after Google sends the user back: swap the code for their identity, find or create
     * their account, and start a session. `previousToken`: a session cookie the browser already
     * had. It's ended, never reused (same as a password login: prevents session fixation).
     * `created`: this was their first sign-in, so the app welcomes them.
     */
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
