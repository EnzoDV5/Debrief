// Password rules and the strength meter, shared by the sign-up form and the api.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULE = `Use at least ${PASSWORD_MIN_LENGTH} characters, with letters, numbers and symbols.`;

const hasLetter = (p: string) => /\p{L}/u.test(p);
const hasNumber = (p: string) => /\p{N}/u.test(p);
const hasSymbol = (p: string) => /[^\p{L}\p{N}\s]/u.test(p);

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export function passwordMissing(password: string): string | null {
  const parts = missingParts(password);
  return parts.length ? `Add ${joinList(parts)}` : null;
}

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
  score: 0 | 1 | 2 | 4;
  label: '' | 'Weak' | 'Fair' | 'Strong';
};

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' };
  const missing = missingParts(password).length;
  if (missing >= 2) return { score: 1, label: 'Weak' };
  if (missing === 1) return { score: 2, label: 'Fair' };
  return { score: 4, label: 'Strong' };
}
