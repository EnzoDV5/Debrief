/** Join class names, skipping falsy values: cn('a', isActive && 'b'). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
