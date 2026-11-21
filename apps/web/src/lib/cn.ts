// Joins class names and lets the last Tailwind class win when two clash.
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['card', 'panel', 'pill', 'mark'],
      shadow: ['card', 'raised', 'glow'],
      tracking: ['label'],
      spacing: ['sidebar', 'rail', 'topbar', 'tabbar'],
      container: ['content', 'form'],
      animate: ['blob-1', 'blob-2', 'blob-3'],
      ease: ['out-3'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
