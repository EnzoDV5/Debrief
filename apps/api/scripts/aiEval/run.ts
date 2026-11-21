import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { detectMeetingDate, parseTranscript, type SourceType } from '@debrief/shared';
import type { ZodType } from 'zod';
import { aiModelChain, env } from '../../src/config/env';
import {
  AiError,
  createOpenRouterClient,
  FATAL,
} from '../../src/modules/analysis/openRouterClient';
import { checkActionItems, checkDecisions } from '../../src/modules/analysis/postChecks';
import { formatTranscript, parseModelJson, steps } from '../../src/modules/analysis/prompts';
import { scenarios, type EvalResult, type Scenario } from './scenarios';

const { values: args } = parseArgs({
  options: {
    free: { type: 'boolean' },
    model: { type: 'string' },
    only: { type: 'string' },
    file: { type: 'string' },
  },
});

const models = args.model
  ? [args.model]
  : args.free
    ? aiModelChain(env)
    : [env.AI_MODEL_PAID_FALLBACK?.split(',')[0]?.trim()].filter((m): m is string => !!m);
if (!env.OPENROUTER_API_KEY || models.length === 0) {
  console.error(
    !env.OPENROUTER_API_KEY
      ? 'OPENROUTER_API_KEY is not set.'
      : 'AI_MODEL_PAID_FALLBACK is not set. Set it, or pass --model <id>, or run with --free.',
  );
  process.exit(1);
}

const ai = createOpenRouterClient({
  apiKey: env.OPENROUTER_API_KEY,
  appUrl: env.APP_URL,
  timeoutMs: env.AI_TIMEOUT_MS,
});

type StepConfig<T> = {
  system: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  output: ZodType<T>;
};

// Same rules as the worker: try each model in turn, and only accept output that passes Zod.
async function ask<T>(config: StepConfig<T>, transcript: string): Promise<T> {
  const problems: string[] = [];
  for (const model of models) {
    try {
      const content = await ai.complete({ model, user: transcript, ...config });
      const parsed = config.output.safeParse(parseModelJson(content));
      if (parsed.success) return parsed.data;
      problems.push(`${model}: output failed validation`);
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      problems.push(`${model}: ${err.kind}`);
      if (FATAL.has(err.kind)) break;
    }
  }
  throw new Error(problems.join('; '));
}

async function analyse(raw: string, sourceType: SourceType, meetingDate: string) {
  const lines = parseTranscript(raw, sourceType);
  const transcript = formatTranscript(lines);
  const summary = await ask(steps.summary, transcript);
  const decisions = await ask(steps.decisions, transcript);
  const items = await ask(steps.action_items, transcript);
  const result: EvalResult = {
    summary: summary.summary,
    decisions: checkDecisions(decisions, lines),
    items: checkActionItems(items, lines, meetingDate),
  };
  return result;
}

const sourceTypeOf = (file: string) => (extname(file).slice(1) || 'txt') as SourceType;

// Prints the result roughly the way the meeting page lays it out.
function show(result: EvalResult) {
  console.log(`  Summary: ${result.summary}`);
  if (result.items.length === 0 && result.decisions.length === 0) {
    console.log('  → Page shows the "Nothing to action" card');
    return;
  }
  console.log(`  Decisions (${result.decisions.length})`);
  for (const d of result.decisions) {
    console.log(`    ◆ ${d.text}${d.sourceLine ? `  [line ${d.sourceLine}]` : '  [no line]'}`);
  }
  console.log(`  Action items (${result.items.length})`);
  for (const i of result.items) {
    const due = i.dueDate ? `${i.dueDate} ("${i.dueDateText}")` : 'no due date';
    console.log(
      `    ☐ ${i.text} · ${i.owner ?? 'no owner'} · ${due}${i.sourceLine ? `  [line ${i.sourceLine}]` : ''}`,
    );
    if (i.needsReview) console.log(`      ⚑ needs review: ${i.reviewReason}`);
  }
}

async function runScenario(scenario: Scenario) {
  const path = resolve(import.meta.dirname, '../../test/fixtures/transcripts', scenario.file);
  const started = Date.now();
  console.log(`\n━━ ${scenario.file} — ${scenario.why}`);
  try {
    const result = await analyse(
      readFileSync(path, 'utf8'),
      sourceTypeOf(scenario.file),
      scenario.meetingDate,
    );
    show(result);
    let passed = 0;
    for (const check of scenario.checks) {
      const outcome = check.test(result);
      if (outcome === true) passed++;
      console.log(
        `    ${outcome === true ? '✔' : '✘'} ${check.label}${outcome === true ? '' : ` (${outcome})`}`,
      );
    }
    return {
      scenario: scenario.file,
      result: passed === scenario.checks.length ? 'PASS' : 'FAIL',
      checks: `${passed}/${scenario.checks.length}`,
      items: result.items.length,
      decisions: result.decisions.length,
      flagged: result.items.filter((i) => i.needsReview).length,
      seconds: Math.round((Date.now() - started) / 100) / 10,
    };
  } catch (err) {
    console.log(`  ✘ AI error: ${err instanceof Error ? err.message : String(err)}`);
    return { scenario: scenario.file, result: 'ERROR', checks: '-', seconds: 0 };
  }
}

console.log(`Models: ${models.join(' → ')}`);

if (args.file) {
  const raw = readFileSync(args.file, 'utf8');
  const date =
    detectMeetingDate(parseTranscript(raw, sourceTypeOf(args.file))) ??
    new Date().toISOString().slice(0, 10);
  console.log(`\n━━ ${basename(args.file)} (meeting date ${date})`);
  show(await analyse(raw, sourceTypeOf(args.file), date));
} else {
  const chosen = scenarios.filter((s) => !args.only || s.file.startsWith(args.only));
  const rows = [];
  for (const scenario of chosen) rows.push(await runScenario(scenario));
  console.log('\n');
  console.table(rows);
  if (rows.some((row) => row.result !== 'PASS')) process.exitCode = 1;
}
