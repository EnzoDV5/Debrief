import type { AskMeetingResponse } from '@debrief/shared';
import { ArrowUp, Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { LineLink } from '@/features/actionItems/ActionItemCard';
import { cn } from '@/lib/cn';
import { useAskMeeting } from '../hooks';

const suggestions = [
  'What decisions were made?',
  'What is blocking progress?',
  'What is still unresolved?',
];

type Exchange = { question: string; result: AskMeetingResponse };

const chip =
  'rounded-pill border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent';

/**
 * "Ask this meeting", opened from the dropdown at the top of the transcript panel. No card: it
 * sits on the panel like the transcript. The question box is a compact chat-style field with the
 * send button inside it, not a full-width form row.
 */
export function AskMeetingPanel({ meetingId }: { meetingId: string }) {
  const ask = useAskMeeting(meetingId);
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [selected, setSelected] = useState(0);
  const shown = exchanges[selected];
  const canSend = question.trim().length >= 3;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 3 || ask.isPending) return;
    ask.mutate(text, {
      onSuccess: (result) => {
        setSelected(exchanges.length);
        setExchanges((previous) => [...previous, { question: text, result }]);
        setQuestion('');
      },
    });
  };

  return (
    <section aria-label="Ask this meeting" aria-busy={ask.isPending} className="px-1">
      <p className="text-sm text-muted">
        Get a short answer with links to the words that support it.
      </p>

      <form onSubmit={submit} className="relative mt-3 max-w-2xl">
        <Sparkles
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-accent"
        />
        <input
          ref={input}
          aria-label="Ask a question about this meeting"
          placeholder="e.g. Why did we choose this approach?"
          value={question}
          maxLength={500}
          onChange={(event) => {
            setQuestion(event.target.value);
            if (ask.isError) ask.reset();
          }}
          className="h-12 w-full rounded-pill border border-line-strong bg-surface pr-14 pl-11 text-base text-fg shadow-card transition-colors placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={!canSend || ask.isPending}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-pill bg-accent text-accent-fg shadow-glow transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ask.isPending ? <Spinner /> : <ArrowUp aria-hidden="true" className="size-4" />}
        </button>
      </form>

      {exchanges.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuestion(suggestion);
                input.current?.focus();
              }}
              className={chip}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {ask.isPending && (
        <p role="status" className="mt-3 text-sm text-muted">
          Reading the transcript for an answer…
        </p>
      )}
      {ask.error && (
        <Alert tone="danger" className="mt-3 max-w-2xl">
          {ask.error.message}
        </Alert>
      )}

      {shown && (
        <div className="mt-5 max-w-3xl">
          {exchanges.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2" aria-label="Questions asked this visit">
              {exchanges.map((exchange, index) => (
                <button
                  key={index}
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => setSelected(index)}
                  className={cn(
                    chip,
                    'max-w-64 truncate',
                    index === selected &&
                      'border-accent/40 bg-accent-soft font-semibold text-accent',
                  )}
                >
                  {exchange.question}
                </button>
              ))}
            </div>
          )}
          {/* The answer reads like a quote: a coloured rule, no box. */}
          <div className="border-l-2 border-accent pl-4" aria-live="polite">
            <p className="text-sm font-semibold text-muted">{shown.question}</p>
            <p className="mt-1.5 text-base leading-7 whitespace-pre-wrap">
              {shown.result.answer ?? 'I couldn’t find an answer supported by this transcript.'}
            </p>
            {shown.result.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span>Check the source:</span>
                {shown.result.citations.map((line) => (
                  <LineLink key={line} meetingId={meetingId} line={line} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
