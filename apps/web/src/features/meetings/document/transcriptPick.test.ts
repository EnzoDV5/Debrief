// Turning a click or selection into a pick.
import { describe, expect, it } from 'vitest';
import { pickText, sentencesOf } from './transcriptPick';

const split = (text: string) => sentencesOf(text).map((r) => text.slice(r.start, r.end));

describe('sentencesOf', () => {
  it('splits at . ! and ?, keeping the spaces after each sentence', () => {
    expect(split('Great. Are we good to release? Yes!')).toEqual([
      'Great. ',
      'Are we good to release? ',
      'Yes!',
    ]);
  });

  it('keeps a last sentence without an end mark, and closing quotes with their sentence', () => {
    expect(split('She said “ship it.” Then we left')).toEqual([
      'She said “ship it.” ',
      'Then we left',
    ]);
  });

  it('covers the whole text with no gaps, so every word can be clicked', () => {
    const text = 'One... two?! three';
    const ranges = sentencesOf(text);
    expect(ranges[0]!.start).toBe(0);
    expect(ranges.at(-1)!.end).toBe(text.length);
    ranges.slice(1).forEach((r, i) => expect(r.start).toBe(ranges[i]!.end));
  });

  it('treats text with no sentence marks, or no text, as one sentence', () => {
    expect(split('just some words')).toEqual(['just some words']);
    expect(sentencesOf('')).toEqual([{ start: 0, end: 0 }]);
  });
});

describe('pickText', () => {
  it('tidies the spaces and keeps the quote the same words as the text', () => {
    expect(pickText(4, '  Send   the deck. ')).toEqual({
      text: 'Send the deck.',
      line: 4,
      quote: 'Send the deck.',
    });
  });
});
