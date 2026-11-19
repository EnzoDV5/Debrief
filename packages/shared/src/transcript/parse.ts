import type { SourceType, TranscriptLine } from '../schemas/meetings';

/**
 * Turns a raw transcript into numbered lines: { n, speaker?, text }.
 * Line numbers are what the AI will cite ("source_line: 12") and what the UI links to, so the
 * same input must always give the same numbering. The api stores the result; the web runs the
 * same function to preview a transcript before it's saved.
 */
export function parseTranscript(raw: string, sourceType: SourceType): TranscriptLine[] {
  const text = normaliseNewlines(raw);
  // Pasted text that is actually a VTT export (people copy whole files) gets the VTT treatment.
  const isVtt = sourceType === 'vtt' || (sourceType === 'paste' && /^WEBVTT\b/.test(text));
  if (isVtt) return number(parseVttCues(text));
  return number(parsePlainLines(text, { markdown: sourceType === 'md' }));
}

type Utterance = { speaker?: string; text: string };

function number(utterances: Utterance[]): TranscriptLine[] {
  return utterances.map((u, i) =>
    u.speaker ? { n: i + 1, speaker: u.speaker, text: u.text } : { n: i + 1, text: u.text },
  );
}

function normaliseNewlines(text: string): string {
  // Some editors start files with an invisible byte-order mark (code point 0xFEFF). Drop it,
  // otherwise a pasted VTT export wouldn't start with "WEBVTT" and wouldn't be recognised.
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, '\n');
}

// ---------------------------------------------------------------------------------------------
// WebVTT (Teams, Zoom, Google Meet exports)
// ---------------------------------------------------------------------------------------------

const TIMING_LINE = /-->/;
// <v Thandi Nkosi> or <v.loud Thandi Nkosi>
const VOICE_TAG = /^<v(?:\.[^\s>]+)*\s+([^>]+)>/;

/**
 * A VTT file is blocks separated by blank lines. We keep only cues (a block with a
 * "00:00:01.000 --> 00:00:04.000" timing line) and drop the WEBVTT header, NOTE comments,
 * STYLE/REGION blocks, cue numbers and the timings themselves. Each cue becomes one line.
 */
function parseVttCues(text: string): Utterance[] {
  const utterances: Utterance[] = [];

  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const timingIndex = lines.findIndex((l) => TIMING_LINE.test(l));
    if (timingIndex === -1) continue; // header, NOTE, STYLE, REGION or stray text

    // Everything after the timing line is the cue text; a cue can wrap over several lines.
    const payload = lines
      .slice(timingIndex + 1)
      .join(' ')
      .trim();
    if (!payload) continue;

    const voice = VOICE_TAG.exec(payload);
    const speaker = voice?.[1]?.trim();
    const spoken = cleanText(stripVttTags(payload));
    if (!spoken) continue;

    // Some tools (e.g. Zoom) write "Name: text" instead of <v Name> tags.
    utterances.push(speaker ? { speaker, text: spoken } : splitSpeaker(spoken));
  }
  return utterances;
}

function stripVttTags(text: string): string {
  return (
    text
      // <v Name>, </v>, <c.yellow>, <b>, <i>, <u>, <lang en>, <ruby>, and inline timestamps.
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lrm;|&rlm;/g, '')
  );
}

// ---------------------------------------------------------------------------------------------
// Plain text and Markdown
// ---------------------------------------------------------------------------------------------

// "[00:01:23]", "(01:23)" or a bare "00:01:23.456" at the start of a line. A bare "10:30" is NOT
// stripped: in plain text that's usually part of the sentence ("10:30 we start").
const LEADING_TIMESTAMP =
  /^(?:[[(]\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?[\])]|\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?)\s*[-–—]?\s*/;

function parsePlainLines(text: string, { markdown }: { markdown: boolean }): Utterance[] {
  const utterances: Utterance[] = [];
  let inFrontMatter = false;

  text.split('\n').forEach((rawLine, index) => {
    let line = rawLine.trim();

    if (markdown) {
      // Skip YAML front matter (--- ... --- at the very top of the file).
      if (index === 0 && line === '---') {
        inFrontMatter = true;
        return;
      }
      if (inFrontMatter) {
        if (line === '---') inFrontMatter = false;
        return;
      }
      line = stripMarkdown(line);
    }

    line = cleanText(line.replace(LEADING_TIMESTAMP, ''));
    if (!line) return;
    utterances.push(splitSpeaker(line));
  });
  return utterances;
}

function stripMarkdown(line: string): string {
  if (/^([-*_])(\s*\1){2,}$/.test(line)) return ''; // horizontal rule
  return line
    .replace(/^#{1,6}\s+/, '') // headings
    .replace(/^>\s?/, '') // blockquote
    .replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '') // list items and task boxes
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images → their text
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
    .replace(/(\*|_)(.+?)\1/g, '$2') // italic
    .replace(/`([^`]+)`/g, '$1'); // inline code
}

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// Labels that look like "Name: text" but aren't people.
const NOT_SPEAKERS = new Set([
  'action',
  'actions',
  'agenda',
  'attendees',
  'date',
  'decision',
  'decisions',
  'fyi',
  'important',
  'location',
  'meeting',
  'note',
  'notes',
  'present',
  're',
  'subject',
  'summary',
  'time',
  'title',
  'todo',
  'update',
  'warning',
]);

/**
 * "Thandi Nkosi: I'll send it Friday" → { speaker: 'Thandi Nkosi', text: "I'll send it Friday" }.
 * A speaker is 1–4 words starting with a capital letter, then a colon. Anything else (or a label
 * like "Note:") stays as plain text with no speaker. A wrong guess here only affects how the line
 * is displayed; the original transcript is always kept.
 */
function splitSpeaker(line: string): Utterance {
  const match = /^(\p{Lu}[\p{L}'’.-]*(?:\s+[\p{L}'’.-]+){0,3})\s*:\s+(.+)$/u.exec(line);
  const speaker = match?.[1];
  const text = match?.[2];
  if (!speaker || !text || NOT_SPEAKERS.has(speaker.toLowerCase())) return { text: line };
  return { speaker, text };
}
