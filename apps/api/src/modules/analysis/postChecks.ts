import type { TranscriptLine } from '@debrief/shared';
import { resolveDueDate } from './dueDates';
import type { ActionItemsOutput, DecisionsOutput } from './prompts';

// The AI's output has already passed the Zod schema (right shape). These checks ask a different
// question: is it TRUE to the transcript? Each check is plain code we can test and explain.
// Nothing here calls the AI. Anything we can't verify is cleared or flagged, never trusted.

export type DecisionDraft = { text: string; sourceLine: number | null };

export type ActionItemDraft = {
  text: string;
  owner: string | null;
  dueDate: string | null;
  dueDateText: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  sourceLine: number | null;
  sourceQuote: string | null;
  contextSummary: string | null;
};

/** Lowercase, straight quotes, punctuation → spaces, single spaces. For fair text comparison. */
export function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();
}

const lineText = (line: TranscriptLine) =>
  normalise(line.speaker ? `${line.speaker}: ${line.text}` : line.text);

/** Whether these words appear on this line (same forgiving comparison as the AI's quotes). */
export function quoteIsOnLine(line: TranscriptLine, quote: string): boolean {
  const needle = normalise(quote);
  return needle.length > 0 && lineText(line).includes(needle);
}

/** Whole-word / whole-phrase match: "Ann" is in "ann said" but not in "annual". */
function containsPhrase(haystack: string, phrase: string): boolean {
  const needle = normalise(phrase);
  return needle.length > 0 && ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Checks the cited line and quote. If the quote is on the cited line: fine. If it's on a
 * different line (models are sometimes off by one), we use the line where it really is. If it's
 * nowhere, the citation can't be trusted.
 */
function verifySource(
  lines: TranscriptLine[],
  sourceLine: number,
  sourceQuote: string,
): { sourceLine: number | null; problem: string | null } {
  const cited = lines.find((l) => l.n === sourceLine);
  const quote = normalise(sourceQuote);
  // Very short "quotes" ("ok", "yes") would match almost anything, so they prove nothing.
  if (quote.length < 4) {
    return {
      sourceLine: cited ? cited.n : null,
      problem: cited ? null : `Line ${sourceLine} doesn't exist`,
    };
  }
  if (cited && lineText(cited).includes(quote)) return { sourceLine: cited.n, problem: null };

  const actual = lines.find((l) => lineText(l).includes(quote));
  if (actual) return { sourceLine: actual.n, problem: null };

  return {
    sourceLine: cited ? cited.n : null,
    problem: cited
      ? `Couldn't find the quoted words on line ${sourceLine}`
      : `Line ${sourceLine} doesn't exist`,
  };
}

export function checkDecisions(output: DecisionsOutput, lines: TranscriptLine[]): DecisionDraft[] {
  const seen = new Set<string>();
  return output.decisions.flatMap((decision) => {
    const key = normalise(decision.text);
    if (seen.has(key)) return []; // models occasionally repeat themselves
    seen.add(key);
    const { sourceLine, problem } = verifySource(
      lines,
      decision.source_line,
      decision.source_quote,
    );
    // Decisions have no review flag: an unverifiable citation is simply dropped.
    return [{ text: decision.text, sourceLine: problem ? null : sourceLine }];
  });
}

export function checkActionItems(
  output: ActionItemsOutput,
  lines: TranscriptLine[],
  meetingDate: string,
): ActionItemDraft[] {
  const transcript = lines.map(lineText).join(' ');
  const seen = new Set<string>();

  return output.action_items.flatMap((item) => {
    const key = normalise(item.text);
    if (seen.has(key)) return [];
    seen.add(key);

    const reasons: string[] = [];

    // 1. Source line and quote must be real.
    const source = verifySource(lines, item.source_line, item.source_quote);
    if (source.problem) reasons.push(source.problem);

    // 2. The owner must be someone the transcript actually names.
    let owner = item.owner;
    if (owner && !containsPhrase(transcript, owner)) {
      reasons.push(`Owner “${owner}” isn't mentioned in the transcript`);
      owner = null;
    }

    // 3. The deadline words must be in the transcript; our code (not the AI) turns them into a date.
    let dueDateText = item.due_date_text;
    let dueDate: string | null = null;
    if (dueDateText && !transcript.includes(normalise(dueDateText))) {
      reasons.push(`Due date “${dueDateText}” isn't in the transcript`);
      dueDateText = null;
    } else if (dueDateText) {
      const resolved = resolveDueDate(dueDateText, meetingDate);
      dueDate = resolved.date;
      if (resolved.review) reasons.push(resolved.review);
    }

    return [
      {
        text: item.text,
        owner,
        dueDate,
        dueDateText,
        needsReview: reasons.length > 0,
        reviewReason: reasons.length > 0 ? reasons.join('. ') : null,
        sourceLine: source.sourceLine,
        sourceQuote: item.source_quote || null,
        contextSummary: source.problem ? null : item.context_summary?.trim() || null,
      },
    ];
  });
}
