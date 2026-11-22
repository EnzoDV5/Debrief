// Checks the AI's answers against the transcript. Made-up owners, dates or quotes get flagged.
import type { TranscriptLine } from '@debrief/shared';
import { resolveDueDate } from './dueDates';
import type { ActionItemsOutput, DecisionsOutput } from './prompts';

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
  // Position in the checked decisions list (0 = D1), or null for no link.
  decisionIndex: number | null;
};

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

export function quoteIsOnLine(line: TranscriptLine, quote: string): boolean {
  const needle = normalise(quote);
  return needle.length > 0 && lineText(line).includes(needle);
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const needle = normalise(phrase);
  return needle.length > 0 && ` ${haystack} `.includes(` ${needle} `);
}

function verifySource(
  lines: TranscriptLine[],
  sourceLine: number,
  sourceQuote: string,
): { sourceLine: number | null; problem: string | null } {
  const cited = lines.find((l) => l.n === sourceLine);
  const quote = normalise(sourceQuote);
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
    if (seen.has(key)) return [];
    seen.add(key);
    const { sourceLine, problem } = verifySource(
      lines,
      decision.source_line,
      decision.source_quote,
    );
    return [{ text: decision.text, sourceLine: problem ? null : sourceLine }];
  });
}

export function checkActionItems(
  output: ActionItemsOutput,
  lines: TranscriptLine[],
  meetingDate: string,
  decisionCount = 0,
): ActionItemDraft[] {
  const transcript = lines.map(lineText).join(' ');
  const seen = new Set<string>();

  return output.action_items.flatMap((item) => {
    const key = normalise(item.text);
    if (seen.has(key)) return [];
    seen.add(key);

    const reasons: string[] = [];

    const source = verifySource(lines, item.source_line, item.source_quote);
    if (source.problem) reasons.push(source.problem);

    let owner = item.owner;
    if (owner && !containsPhrase(transcript, owner)) {
      reasons.push(`Owner “${owner}” isn't mentioned in the transcript`);
      owner = null;
    }

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
        // A decision number that doesn't exist (D7 of 3) is dropped: the task stays, unlinked.
        // Not flagged for review, since nothing the user sees is wrong.
        decisionIndex:
          item.decision != null && item.decision >= 1 && item.decision <= decisionCount
            ? item.decision - 1
            : null,
      },
    ];
  });
}
