// Schemas for sign-up, log-in and account forms. The api enforces them, the forms reuse them.
import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, passwordMissing } from '../password';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address')
  .max(254, 'Email address is too long')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(1, 'Enter a password')
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`)
  .superRefine((password, ctx) => {
    if (!password) return;
    const missing = passwordMissing(password);
    if (missing) ctx.addIssue({ code: 'custom', message: missing });
  });

const nameSchema = z.string().trim().min(1, 'Enter your name').max(100, 'Name is too long');

// Changing your display name (account page). Same rules as at sign-up.
export const updateProfileSchema = z.object({ name: nameSchema });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128, 'Use 128 characters or fewer'),
});
export type LoginInput = z.infer<typeof loginSchema>;

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

export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  hasPassword: z.boolean(),
  // The photo to show: an uploaded one if there is one, else the Google photo, else null.
  avatarUrl: z.string().nullable(),
  // True when the user uploaded their own photo (so it can be removed again).
  hasUploadedAvatar: z.boolean(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

// Uploaded profile photos. The browser shrinks them to AVATAR_SIZE px square before sending,
// so real uploads are far below the cap; the cap only stops abuse.
export const AVATAR_SIZE = 256;
export const MAX_AVATAR_BYTES = 512 * 1024;
export const AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const authResponseSchema = z.object({ user: publicUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const authProvidersSchema = z.object({ google: z.boolean(), passwordReset: z.boolean() });
export type AuthProviders = z.infer<typeof authProvidersSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'This reset link is incomplete').max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const GOOGLE_SIGN_IN_ERRORS = ['denied', 'unverified', 'unavailable', 'error'] as const;
export type GoogleSignInError = (typeof GOOGLE_SIGN_IN_ERRORS)[number];
