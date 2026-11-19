import type { AskMeetingResponse } from '@debrief/shared';
import { ArrowUp, Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { LineLink } from '@/features/actionItems/ActionItemCard';
import { useAskMeeting } from '../hooks';

const suggestions = [
  'What decisions were made?',
  'What is blocking progress?',
  'What is still unresolved?',
];

type Exchange = { question: string; result: AskMeetingResponse };

export function AskMeetingCard({ meetingId }: { meetingId: string }) {
  const ask = useAskMeeting(meetingId);
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [selected, setSelected] = useState(0);
  const shown = exchanges[selected];

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
    <Card
      role="region"
      aria-label="Ask this meeting"
      aria-busy={ask.isPending}
      className="mt-4 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"
        >
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 className="font-bold">Ask this meeting</h2>
          <p className="mt-0.5 text-sm text-muted">
            Get a short answer with links to the words that support it.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          ref={input}
          aria-label="Ask a question about this meeting"
          placeholder="e.g. Why did we choose this approach?"
          value={question}
          maxLength={500}
          onChange={(event) => {
            setQuestion(event.target.value);
            if (ask.isError) ask.reset();
          }}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          icon={<ArrowUp aria-hidden="true" className="size-4" />}
          loading={ask.isPending}
          disabled={question.trim().length < 3}
          className="sm:self-start"
        >
          Ask
        </Button>
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
              className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
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
        <Alert tone="danger" className="mt-3">
          {ask.error.message}
        </Alert>
      )}

      {shown && (
        <div className="mt-4 border-t border-line pt-4">
          {exchanges.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2" aria-label="Questions asked this visit">
              {exchanges.map((exchange, index) => (
                <button
                  key={index}
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => setSelected(index)}
                  className={`max-w-56 truncate rounded-pill px-3 py-1.5 text-xs transition-colors ${
                    index === selected
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'bg-surface-2 text-muted hover:text-fg'
                  }`}
                >
                  {exchange.question}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-md bg-surface-2 px-4 py-3" aria-live="polite">
            <p className="text-sm font-semibold">{shown.question}</p>
            <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
              {shown.result.answer ?? 'I couldn’t find an answer supported by this transcript.'}
            </p>
            {shown.result.citations.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>Check the source:</span>
                {shown.result.citations.map((line) => (
                  <LineLink key={line} meetingId={meetingId} line={line} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
