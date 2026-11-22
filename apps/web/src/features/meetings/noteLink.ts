// Links to one card (action item or decision) on the meeting page. The card's id travels in the
// router's navigation state, not the URL, so the meeting page can highlight the card you clicked.
// A refresh doesn't highlight it again, which suits a "this is the one you just clicked" cue.

export type NoteLinkState = { highlight: string };

export const noteLinkState = (id: string): NoteLinkState => ({ highlight: id });

/** Reads the card id back out of `location.state`, which could hold anything. */
export function highlightFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('highlight' in state)) return null;
  return typeof state.highlight === 'string' ? state.highlight : null;
}
