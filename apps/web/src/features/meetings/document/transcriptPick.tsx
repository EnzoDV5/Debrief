import { Gavel, ListChecks } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';

// "Select text → create an action item or decision". Turns a selection in the transcript (or a
// whole line, from its + button) into a pick, and shows a small floating toolbar for it.

/** What the user picked: the text for the new item and the line it came from. */
export type TranscriptPick = {
  /** The picked words, across lines if needed (speaker names and line numbers left out). */
  text: string;
  /** The first picked line: the new item sits beside it. */
  line: number;
  /** The picked words on that first line, so the server can check them against the line. */
  quote: string;
};

export type PickToolbarState = {
  pick: TranscriptPick;
  /** Where to show the toolbar (viewport coordinates, since it's position: fixed). */
  x: number;
  y: number;
  /** "selection": above the selected words. "line": beside a line's + button. */
  source: 'selection' | 'line';
};

export type PickKind = 'action' | 'decision';

const MAX_TEXT = 500; // the item / decision text limit in the shared schemas
const MAX_QUOTE = 1000;
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();
const isWordChar = (char: string | undefined) => !!char && /[\p{L}\p{N}'’]/u.test(char);

/** How many characters of `el`'s text come before a point (node + offset) inside it. */
function offsetIn(el: HTMLElement, node: Node, offset: number): number {
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(node, offset);
  return before.toString().length;
}

/**
 * Reads the current selection inside `container`. Only the transcript text counts: each line's
 * text element carries data-line-text="<n>", so selecting across a speaker name or a line number
 * still yields just the spoken words. Returns null for an empty or outside selection.
 */
export function readSelection(container: HTMLElement): Omit<PickToolbarState, 'source'> | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const parts: Array<{ line: number; text: string }> = [];
  for (const el of container.querySelectorAll<HTMLElement>('[data-line-text]')) {
    if (!range.intersectsNode(el)) continue;
    // Where the selection starts and ends within this line's text (whole line if it goes past).
    const full = el.textContent ?? '';
    let start = el.contains(range.startContainer)
      ? offsetIn(el, range.startContainer, range.startOffset)
      : 0;
    let end = el.contains(range.endContainer)
      ? offsetIn(el, range.endContainer, range.endOffset)
      : full.length;
    // Snap out to whole words: people rarely stop exactly on a word's edge ("good to r").
    while (start > 0 && isWordChar(full[start - 1]) && isWordChar(full[start])) start--;
    while (end < full.length && isWordChar(full[end - 1]) && isWordChar(full[end])) end++;
    const text = collapse(full.slice(start, end));
    if (text) parts.push({ line: Number(el.dataset.lineText), text });
  }
  const first = parts[0];
  if (!first) return null;

  // Not available in every environment (e.g. jsdom); fall back to the container's corner.
  const box = range.getBoundingClientRect?.() ?? container.getBoundingClientRect();
  return {
    pick: {
      text: parts
        .map((p) => p.text)
        .join(' ')
        .slice(0, MAX_TEXT),
      line: first.line,
      quote: first.text.slice(0, MAX_QUOTE),
    },
    x: box.left + box.width / 2,
    y: box.top,
  };
}

/** The whole line, for the + button beside it. */
export function pickWholeLine(line: { n: number; text: string }): TranscriptPick {
  const text = collapse(line.text);
  return { text: text.slice(0, MAX_TEXT), line: line.n, quote: text.slice(0, MAX_QUOTE) };
}

/**
 * Shows the toolbar when the user finishes selecting transcript text (mouse or keyboard) and
 * hides it when the selection goes away, the page scrolls, or Escape is pressed.
 */
export function useTranscriptSelection(
  containerRef: RefObject<HTMLElement | null>,
  setToolbar: (update: (current: PickToolbarState | null) => PickToolbarState | null) => void,
) {
  useEffect(() => {
    const show = () => {
      const container = containerRef.current;
      const found = container && readSelection(container);
      if (found) setToolbar(() => ({ ...found, source: 'selection' }));
    };
    // A cleared selection removes a selection toolbar (a line toolbar has no selection).
    const hideIfCleared = () => {
      if (window.getSelection()?.isCollapsed ?? true) {
        setToolbar((current) => (current?.source === 'selection' ? null : current));
      }
    };
    const hide = () => setToolbar(() => null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
      else if (event.shiftKey) show(); // keyboard selection (Shift + arrows)
    };

    document.addEventListener('pointerup', show);
    document.addEventListener('keyup', onKey);
    document.addEventListener('selectionchange', hideIfCleared);
    // Capture: the transcript scrolls inside the page panel, not the window.
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerup', show);
      document.removeEventListener('keyup', onKey);
      document.removeEventListener('selectionchange', hideIfCleared);
      window.removeEventListener('scroll', hide, true);
    };
  }, [containerRef, setToolbar]);
}

/** The floating "Action item / Decision" toolbar for a pick. */
export function PickToolbar({
  state,
  onChoose,
  onClose,
}: {
  state: PickToolbarState;
  onChoose: (kind: PickKind) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Opened from a line's + button: move focus into the toolbar, and close it on an outside click.
  useEffect(() => {
    if (state.source !== 'line') return;
    ref.current?.querySelector('button')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [state, onClose]);

  const button =
    'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-2';
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Create from the transcript"
      // Position comes from the selection at runtime, so it can't be a class.
      style={{ left: state.x, top: state.y }}
      className={
        'fixed z-40 flex gap-1 rounded-pill border border-white/70 glass-float p-1 shadow-raised ' +
        (state.source === 'selection'
          ? '-translate-x-1/2 -translate-y-[calc(100%+0.5rem)]'
          : 'translate-x-2 -translate-y-1/2')
      }
    >
      {/* preventDefault on pointerdown keeps the text selected while clicking. */}
      <button
        type="button"
        className={button}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => onChoose('action')}
      >
        <ListChecks aria-hidden="true" className="size-4 text-accent" />
        Action item
      </button>
      <button
        type="button"
        className={button}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => onChoose('decision')}
      >
        <Gavel aria-hidden="true" className="size-4 text-success" />
        Decision
      </button>
    </div>
  );
}
