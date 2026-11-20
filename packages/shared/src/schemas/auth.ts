import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, passwordMissing } from '../password';

// Used by both the api (enforced) and the web forms (instant feedback). The server is the
// source of truth: the browser check is only for a nicer experience.

// Trim + lowercase before checking, so " Alice@Example.com " and "alice@example.com" are the
// same account. 254 is the longest valid email address.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address')
  .max(254, 'Email address is too long')
  .pipe(z.email('Enter a valid email address'));

// A new password (rules in password.ts): 12+ characters with a letter, a number and a symbol.
// The error says exactly what's missing, e.g. "Add 3 more characters and a symbol". The 128 cap
// stops someone sending a multi-megabyte "password" to make argon2 burn CPU.
export const passwordSchema = z
  .string()
  .min(1, 'Enter a password')
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`)
  .superRefine((password, ctx) => {
    if (!password) return; // "Enter a password" already says it
    const missing = passwordMissing(password);
    if (missing) ctx.addIssue({ code: 'custom', message: missing });
  });

/** Sign-up. The web form adds "confirm password" to these fields. */
export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Name is too long'),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Login only checks that a password was typed: the length rule is for new passwords, and a
// different error here would hint at what the real password looks like.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128, 'Use 128 characters or fewer'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Confirming a delete: password accounts type their password. Accounts made with Google have no
// password, so they type their email instead (the server checks whichever the account needs).
// The web form uses the one that fits the account (so its field errors show inline); the api
// accepts either.
export const deleteWithPasswordSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(128, 'Use 128 characters or fewer'),
});
export const deleteWithEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email address')
    .max(254, 'Email address is too long'),
});
export const deleteAccountSchema = z.union([deleteWithPasswordSchema, deleteWithEmailSchema]);
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// What the api returns about a user. Never includes the password hash.
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  /** False for accounts made with Google: they sign in with Google and have no password. */
  hasPassword: z.boolean(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const authResponseSchema = z.object({ user: publicUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

// Which sign-in options this server offers. Each is only offered when it's set up on the server
// (Google keys for Google sign-in; EmailJS keys for "Forgot password").
export const authProvidersSchema = z.object({ google: z.boolean(), passwordReset: z.boolean() });
export type AuthProviders = z.infer<typeof authProvidersSchema>;

// "Forgot password": ask for a link by email, then set a new password with the link's token.
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'This reset link is incomplete').max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Why Google sign-in sent the user back to the login page (?google=...). The page turns each
 * into a friendly message.
 */
export const GOOGLE_SIGN_IN_ERRORS = ['denied', 'unverified', 'unavailable', 'error'] as const;
export type GoogleSignInError = (typeof GOOGLE_SIGN_IN_ERRORS)[number];
