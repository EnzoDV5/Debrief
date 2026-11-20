// Password rules and a strength estimate, shared by the api (which enforces the rules) and the
// sign-up form (which shows what's still missing as you type, plus a strength bar).
// Plain code, no library: the rules are simple enough to read in one go.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** The rule in one sentence, shown under the empty password field. */
export const PASSWORD_RULE = `Use at least ${PASSWORD_MIN_LENGTH} characters, with letters, numbers and symbols.`;

const hasLetter = (p: string) => /\p{L}/u.test(p);
const hasNumber = (p: string) => /\p{N}/u.test(p);
// Anything that isn't a letter, number or space counts as a symbol: - _ ! @ # é's accent etc.
const hasSymbol = (p: string) => /[^\p{L}\p{N}\s]/u.test(p);

/** "a", "a and b", "a, b and c" */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/**
 * What a new password still needs, as one sentence, e.g. "Add 3 more characters and a symbol".
 * Null when it meets every rule. Used for the live hint and as the server's error, so the person
 * always sees exactly what to fix.
 */
export function passwordMissing(password: string): string | null {
  const parts = missingParts(password);
  return parts.length ? `Add ${joinList(parts)}` : null;
}

/** Each thing still missing, e.g. ["3 more characters", "a symbol"]. Empty = meets the rules. */
function missingParts(password: string): string[] {
  const parts: string[] = [];
  const short = PASSWORD_MIN_LENGTH - password.length;
  if (short > 0) parts.push(`${short} more character${short === 1 ? '' : 's'}`);
  if (!hasLetter(password)) parts.push('a letter');
  if (!hasNumber(password)) parts.push('a number');
  if (!hasSymbol(password)) parts.push('a symbol');
  return parts;
}

export type PasswordStrength = {
  /** How many of the bar's four segments fill: 0 nothing typed · 1 weak · 2 fair · 4 strong */
  score: 0 | 1 | 2 | 4;
  label: '' | 'Weak' | 'Fair' | 'Strong';
};

/**
 * The strength bar: how close the password is to the rules, which already make it strong (12+
 * characters with letters, numbers and symbols). It fills up as the person gets there:
 *   Weak   still missing two or more things (e.g. too short and no number)
 *   Fair   missing just one thing
 *   Strong meets the rules (the bar fills completely)
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' };
  const missing = missingParts(password).length;
  if (missing >= 2) return { score: 1, label: 'Weak' };
  if (missing === 1) return { score: 2, label: 'Fair' };
  return { score: 4, label: 'Strong' };
}
