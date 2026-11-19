import { readFileSync } from 'node:fs';
import { detectMeetingDate, parseTranscript } from '@debrief/shared';
import { describe, expect, it } from 'vitest';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/transcripts/${name}`, import.meta.url), 'utf8');

const BOM = String.fromCharCode(0xfeff); // invisible byte-order mark

describe('parseTranscript: WebVTT', () => {
  const lines = parseTranscript(fixture('messy-planning.vtt'), 'vtt');

  it('keeps one numbered line per cue and drops header, NOTE, STYLE, cue numbers and timings', () => {
    expect(lines).toHaveLength(15);
    expect(lines.map((l) => l.n)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    const all = lines.map((l) => l.text).join(' ');
    for (const leftover of ['WEBVTT', 'Kind:', 'NOTE', 'attribution', '::cue', '-->', '00:00']) {
      expect(all).not.toContain(leftover);
    }
  });

  it('takes the speaker from <v Name> tags, including <v.class Name>', () => {
    expect(lines[0]).toEqual({
      n: 1,
      speaker: 'Lerato Dlamini',
      text: "Okay, can everyone hear me? Sipho, you're on mute I think.",
    });
    expect(lines[3]?.speaker).toBe('Sipho Mthembu'); // <v.loud Sipho Mthembu>
  });

  it('joins a cue that wraps over several lines', () => {
    expect(lines[2]?.text).toBe(
      'Right, so the Q1 planning. Um, the big one is the mobile app, we keep pushing it and the board is asking.',
    );
  });

  it('strips formatting tags and decodes entities', () => {
    expect(lines[5]?.text).toContain('If we pause the rewrite');
    expect(lines[12]?.text).toContain('brand assets & icons');
  });

  it('handles Windows line endings and a byte-order mark', () => {
    const windows = BOM + 'WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\n<v Ann>Hi there</v>\r\n';
    expect(parseTranscript(windows, 'vtt')).toEqual([{ n: 1, speaker: 'Ann', text: 'Hi there' }]);
  });

  it('falls back to "Name: text" when a cue has no voice tag (Zoom style)', () => {
    const zoom = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nBen Smith: Morning all\n';
    expect(parseTranscript(zoom, 'vtt')).toEqual([
      { n: 1, speaker: 'Ben Smith', text: 'Morning all' },
    ]);
  });

  it('still recognises pasted VTT that starts with a byte-order mark', () => {
    const pasted = BOM + 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Ann>Hello</v>\n';
    expect(parseTranscript(pasted, 'paste')).toEqual([{ n: 1, speaker: 'Ann', text: 'Hello' }]);
  });

  it('treats pasted text that starts with WEBVTT as VTT', () => {
    const pasted = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Ann>Hello</v>\n';
    expect(parseTranscript(pasted, 'paste')).toEqual([{ n: 1, speaker: 'Ann', text: 'Hello' }]);
  });
});

describe('parseTranscript: plain text', () => {
  it('numbers lines and recognises "Name: text" speakers, including lowercase particles', () => {
    const lines = parseTranscript(fixture('clean-standup.txt'), 'txt');

    expect(lines).toHaveLength(17);
    expect(lines[0]).toEqual({ n: 1, text: 'Weekly product sync, Tuesday 24 November 2026' });
    expect(lines[3]).toEqual({
      n: 4,
      speaker: 'Pieter van Wyk',
      text: 'Onboarding is code complete. QA found two small bugs in the email verification step, both fixed yesterday.',
    });
  });

  it('does not treat labels like "Attendees:" or "Note:" as speakers', () => {
    const lines = parseTranscript('Attendees: Ann, Ben\nNote: room changed', 'paste');
    expect(lines.every((l) => l.speaker === undefined)).toBe(true);
  });

  it('strips bracketed and hh:mm:ss timestamps but keeps a time that is part of a sentence', () => {
    const lines = parseTranscript(fixture('tricky-dates-owners.txt'), 'txt');
    expect(lines).toHaveLength(12);
    expect(lines[0]).toEqual({
      n: 1,
      speaker: 'Mpho Sithole',
      text: 'Quick one about the office move.',
    });
    expect(lines[11]?.text).toBe('Note: parking permits for the new building are still unclear.');

    expect(parseTranscript('10:30 we start', 'paste')).toEqual([{ n: 1, text: '10:30 we start' }]);
  });

  it('skips blank lines and collapses extra whitespace', () => {
    expect(parseTranscript('\n\n  Ann:   hello    there  \n\n\n', 'paste')).toEqual([
      { n: 1, speaker: 'Ann', text: 'hello there' },
    ]);
  });

  it('returns no lines for whitespace-only input', () => {
    expect(parseTranscript(' \n\t\n ', 'paste')).toEqual([]);
  });

  it('removes a byte-order mark so the first speaker is still recognised', () => {
    // Without stripping it, the invisible BOM would sit before "Ann" and hide the speaker.
    expect(parseTranscript(BOM + 'Ann: hi\r\nBen: hello', 'txt')).toEqual([
      { n: 1, speaker: 'Ann', text: 'hi' },
      { n: 2, speaker: 'Ben', text: 'hello' },
    ]);
  });
});

describe('parseTranscript: Markdown', () => {
  const lines = parseTranscript(fixture('no-actions-retro.md'), 'md');

  it('skips front matter and strips headings, bullets, quotes and bold', () => {
    expect(lines).toHaveLength(13);
    expect(lines[0]).toEqual({ n: 1, text: 'Sprint 14 retrospective' });
    expect(lines.map((l) => l.text).join(' ')).not.toMatch(/[#*>]|^---|title:/);
  });

  it('finds speakers written in bold inside bullets and quotes', () => {
    expect(lines[2]).toEqual({
      n: 3,
      speaker: 'Naledi',
      text: 'The new review checklist made pull requests much faster to get through.',
    });
    expect(lines.find((l) => l.text.startsWith('Honestly'))?.speaker).toBe('Naledi');
  });
});

describe('detectMeetingDate', () => {
  const lines = (...texts: string[]) => texts.map((text, i) => ({ n: i + 1, text }));

  it.each([
    ['Date: Monday 16 November 2026', '2026-11-16'],
    ['Meeting date: 2026-11-16', '2026-11-16'],
    ['Date - November 16, 2026', '2026-11-16'],
    ['Date: 16/11/2026', '2026-11-16'],
    ['Date: 16th Nov, 2026', '2026-11-16'],
  ])('reads "%s"', (text, expected) => {
    expect(detectMeetingDate(lines('Weekly check-in', text, 'Ann: hi'))).toBe(expected);
  });

  it('uses a full date in the title line when there is no "Date:" label', () => {
    expect(
      detectMeetingDate(lines('Weekly product sync, Tuesday 24 November 2026', 'Ann: hi')),
    ).toBe('2026-11-24');
  });

  it('ignores dates without a year, impossible dates, and dates deep in the discussion', () => {
    expect(detectMeetingDate(lines('Date: Wednesday the 18th'))).toBeNull();
    expect(detectMeetingDate(lines('Date: 31 February 2026'))).toBeNull();
    expect(
      detectMeetingDate(lines('Standup', 'Ann: hi', 'Ben: hi', 'Ann: ship it by 2 December 2026')),
    ).toBeNull();
  });
});
