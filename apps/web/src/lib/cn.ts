import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge knows Tailwind's default scale, not our own token names. Listing them here lets
 * it tell that rounded-md and rounded-card set the same property. Colours need no list: any
 * unknown bg-/text-/border- value is treated as a colour.
 * Keep in sync with styles/tokens.css (cn.test.ts checks the important ones).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['card', 'panel', 'pill', 'mark'],
      shadow: ['card', 'raised', 'glow'],
      tracking: ['label'],
      spacing: ['sidebar', 'topbar', 'tabbar'],
      container: ['content', 'form'],
      animate: ['blob-1', 'blob-2', 'blob-3'],
      ease: ['out-3'],
    },
  },
});

/**
 * Join class names, skipping falsy values, and let the last conflicting Tailwind class win:
 * cn('px-4 bg-accent', isActive && 'bg-danger') → 'px-4 bg-danger'.
 *
 * Why tailwind-merge: without it, two classes for the same property (bg-accent + bg-danger) both
 * end up in the HTML and the one defined later in the CSS file wins, not the one written last.
 * That made component overrides unreliable.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
