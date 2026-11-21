// The "Ask this meeting" card.
import type { AskMeetingResponse } from '@debrief/shared';
import { ArrowUp, Sparkles, X } from 'lucide-react';
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

const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

const chip =
  'rounded-pill border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent';

export function AskMeetingPanel({
  meetingId,
  disabledReason,
}: {
  meetingId: string;
  // Set when asking makes no sense yet (the analysis failed); shown under the box.
  disabledReason?: string;
}) {
  const ask = useAskMeeting(meetingId);
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [selected, setSelected] = useState(0);
  const [answerHidden, setAnswerHidden] = useState(false);
  const shown = answerHidden ? undefined : exchanges[selected];
  const canSend = question.trim().length >= 3;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 3 || ask.isPending) return;
    ask.mutate(text, {
      onSuccess: (result) => {
        setSelected(exchanges.length);
        setExchanges((previous) => [...previous, { question: text, result }]);
        setAnswerHidden(false);
        setQuestion('');
      },
    });
  };
  const showExchange = (index: number) => {
    setSelected(index);
    setAnswerHidden(false);
  };

  return (
    <section
      aria-label="Ask this meeting"
      aria-busy={ask.isPending}
      className={cn(
        'group rounded-card border border-line bg-surface p-4 shadow-raised',
        disabledReason && 'opacity-75',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"
        >
          <Sparkles className="size-4" />
        </span>
        <h2 className="font-bold">Ask this meeting</h2>
      </div>

      <form onSubmit={submit} className="relative mt-3">
        <input
          ref={input}
          disabled={Boolean(disabledReason)}
          aria-describedby={disabledReason ? `${meetingId}-ask-disabled` : undefined}
          aria-label="Ask a question about this meeting"
          placeholder="e.g. Why did we choose this?"
          value={question}
          maxLength={500}
          onChange={(event) => {
            setQuestion(event.target.value);
            if (ask.isError) ask.reset();
          }}
          className="h-12 w-full rounded-pill border border-line-strong bg-surface pr-14 pl-4 text-base text-fg transition-colors placeholder:text-muted focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-2"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={!canSend || ask.isPending || Boolean(disabledReason)}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-pill bg-accent text-accent-fg shadow-glow transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ask.isPending ? <Spinner /> : <ArrowUp aria-hidden="true" className="size-4" />}
        </button>
      </form>
      {disabledReason && (
        <p id={`${meetingId}-ask-disabled`} className="mt-2 text-sm text-muted">
          {disabledReason}
        </p>
      )}

      {!shown && (
        <div
          className="mt-3 hidden flex-wrap gap-2 group-focus-within:flex"
          aria-label={exchanges.length ? 'Questions asked this visit' : 'Suggested questions'}
        >
          {exchanges.length === 0
            ? suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onPointerDown={keepFocus}
                  onClick={() => {
                    setQuestion(suggestion);
                    input.current?.focus();
                  }}
                  className={chip}
                >
                  {suggestion}
                </button>
              ))
            : exchanges.map((exchange, index) => (
                <button
                  key={index}
                  type="button"
                  onPointerDown={keepFocus}
                  onClick={() => showExchange(index)}
                  className={cn(chip, 'max-w-full truncate')}
                >
                  {exchange.question}
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
        <Alert tone="danger" className="mt-3">
          {ask.error.message}
        </Alert>
      )}

      {shown && (
        <div className="mt-4">
          {exchanges.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2" aria-label="Questions asked this visit">
              {exchanges.map((exchange, index) => (
                <button
                  key={index}
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => showExchange(index)}
                  className={cn(
                    chip,
                    'max-w-full truncate',
                    index === selected &&
                      'border-accent/40 bg-accent-soft font-semibold text-accent',
                  )}
                >
                  {exchange.question}
                </button>
              ))}
            </div>
          )}
          <div className="relative border-l-2 border-accent pr-8 pl-4" aria-live="polite">
            <button
              type="button"
              aria-label="Hide answer"
              onClick={() => setAnswerHidden(true)}
              className="absolute top-0 right-0 grid size-7 place-items-center rounded-pill text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
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
