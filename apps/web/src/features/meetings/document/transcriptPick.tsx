// Click or select text in the transcript to turn it into an action item or decision.
import { Gavel, ListChecks, Pencil, UserRound } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export type TranscriptPick = {
  text: string;
  line: number;
  quote: string;
};

export type PickToolbarState = {
  pick: TranscriptPick;
  x: number;
  y: number;
  source: 'selection' | 'click';
  focus?: boolean;
};

export type PickKind = 'action' | 'decision';

const MAX_TEXT = 500;
const MAX_QUOTE = 1000;
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();
const isWordChar = (char: string | undefined) => !!char && /[\p{L}\p{N}'’]/u.test(char);

function offsetIn(el: HTMLElement, node: Node, offset: number): number {
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(node, offset);
  return before.toString().length;
}

export function readSelection(container: HTMLElement): Omit<PickToolbarState, 'source'> | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const parts: Array<{ line: number; text: string }> = [];
  for (const el of container.querySelectorAll<HTMLElement>('[data-line-text]')) {
    if (!range.intersectsNode(el)) continue;
    const full = el.textContent ?? '';
    let start = el.contains(range.startContainer)
      ? offsetIn(el, range.startContainer, range.startOffset)
      : 0;
    let end = el.contains(range.endContainer)
      ? offsetIn(el, range.endContainer, range.endOffset)
      : full.length;
    while (start > 0 && isWordChar(full[start - 1]) && isWordChar(full[start])) start--;
    while (end < full.length && isWordChar(full[end - 1]) && isWordChar(full[end])) end++;
    const text = collapse(full.slice(start, end));
    if (text) parts.push({ line: Number(el.dataset.lineText), text });
  }
  const first = parts[0];
  if (!first) return null;

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

export function pickText(line: number, words: string): TranscriptPick {
  const text = collapse(words);
  return { text: text.slice(0, MAX_TEXT), line, quote: text.slice(0, MAX_QUOTE) };
}

export function sentencesOf(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const pattern = /[^.!?]*[.!?]+["'”’)\]]*\s*|[^.!?]+$/g;
  for (const match of text.matchAll(pattern)) {
    if (match[0].length > 0)
      ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges.length > 0 ? ranges : [{ start: 0, end: text.length }];
}

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
    const hideIfCleared = () => {
      if (window.getSelection()?.isCollapsed ?? true) {
        setToolbar((current) => (current?.source === 'selection' ? null : current));
      }
    };
    const hide = () => setToolbar(() => null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
      else if (event.shiftKey) show();
    };

    document.addEventListener('pointerup', show);
    document.addEventListener('keyup', onKey);
    document.addEventListener('selectionchange', hideIfCleared);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerup', show);
      document.removeEventListener('keyup', onKey);
      document.removeEventListener('selectionchange', hideIfCleared);
      window.removeEventListener('scroll', hide, true);
    };
  }, [containerRef, setToolbar]);
}

export function PickToolbar({
  state,
  onChoose,
  onEdit,
  onSpeaker,
  hasSpeaker = false,
  onClose,
}: {
  state: PickToolbarState;
  onChoose: (kind: PickKind) => void;
  onEdit?: () => void;
  onSpeaker?: () => void;
  hasSpeaker?: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.source !== 'click') return;
    if (state.focus) ref.current?.querySelector('button')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [state, onClose]);

  const button =
    'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-2';
  return createPortal(
    <div
      ref={ref}
      role="toolbar"
      aria-label="Create from the transcript"
      style={{ left: state.x, top: state.y }}
      className="fixed z-40 flex -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] gap-1 rounded-pill border border-glass-edge glass-float p-1 shadow-raised"
    >
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
      {(onEdit || onSpeaker) && <span aria-hidden="true" className="my-1.5 w-px bg-line" />}
      {onSpeaker && (
        <button
          type="button"
          className={button}
          onPointerDown={(event) => event.preventDefault()}
          onClick={onSpeaker}
        >
          <UserRound aria-hidden="true" className="size-4 text-muted" />
          {hasSpeaker ? 'Change speaker' : 'Who said this?'}
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          className={button}
          onPointerDown={(event) => event.preventDefault()}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" className="size-4 text-muted" />
          Edit line
        </button>
      )}
    </div>,
    document.body,
  );
}
