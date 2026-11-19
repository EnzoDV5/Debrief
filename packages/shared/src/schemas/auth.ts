import { z } from 'zod';

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

// Length over complexity rules (current NIST guidance). The 128 cap stops someone sending a
// multi-megabyte "password" to make argon2 burn CPU.
export const PASSWORD_MIN_LENGTH = 12;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Use 128 characters or fewer');

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

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(128, 'Use 128 characters or fewer'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// What the api returns about a user. Never includes the password hash.
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const authResponseSchema = z.object({ user: publicUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;
