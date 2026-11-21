// Turns a raw transcript (plain text, Markdown or VTT) into numbered lines with speakers.
import type { SourceType, TranscriptLine } from '../schemas/meetings';

export function parseTranscript(raw: string, sourceType: SourceType): TranscriptLine[] {
  const text = normaliseNewlines(raw);
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
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, '\n');
}

const TIMING_LINE = /-->/;
const VOICE_TAG = /^<v(?:\.[^\s>]+)*\s+([^>]+)>/;

function parseVttCues(text: string): Utterance[] {
  const utterances: Utterance[] = [];

  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const timingIndex = lines.findIndex((l) => TIMING_LINE.test(l));
    if (timingIndex === -1) continue;

    const payload = lines
      .slice(timingIndex + 1)
      .join(' ')
      .trim();
    if (!payload) continue;

    const voice = VOICE_TAG.exec(payload);
    const speaker = voice?.[1]?.trim();
    const spoken = cleanText(stripVttTags(payload));
    if (!spoken) continue;

    utterances.push(speaker ? { speaker, text: spoken } : splitSpeaker(spoken));
  }
  return utterances;
}

function stripVttTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lrm;|&rlm;/g, '');
}

const LEADING_TIMESTAMP =
  /^(?:[[(]\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?[\])]|\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?)\s*[-–—]?\s*/;

function parsePlainLines(text: string, { markdown }: { markdown: boolean }): Utterance[] {
  const utterances: Utterance[] = [];
  let inFrontMatter = false;

  text.split('\n').forEach((rawLine, index) => {
    let line = rawLine.trim();

    if (markdown) {
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
  if (/^([-*_])(\s*\1){2,}$/.test(line)) return '';
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1');
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

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

function splitSpeaker(line: string): Utterance {
  const match = /^(\p{Lu}[\p{L}'’.-]*(?:\s+[\p{L}'’.-]+){0,3})\s*:\s+(.+)$/u.exec(line);
  const speaker = match?.[1];
  const text = match?.[2];
  if (!speaker || !text || NOT_SPEAKERS.has(speaker.toLowerCase())) return { text: line };
  return { speaker, text };
}
