import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MIN_FIND_LENGTH, type TranscriptFind } from './useTranscriptFind';

const stepButton =
  'grid size-8 place-items-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent ' +
  'lg:text-sidebar-muted lg:hover:bg-sidebar-active lg:hover:text-white lg:focus-visible:outline-white';

/**
 * Exact-word search beside "Ask this meeting": Ask is the AI answering a question, Find is for
 * when you know the words. Instant and free (no AI). Matches light up in the transcript; Enter
 * and Shift+Enter (or the arrows) move between them.
 */
export function FindInTranscript({ find }: { find: TranscriptFind }) {
  const total = find.matches.length;
  const searching = find.query.trim().length >= MIN_FIND_LENGTH;

  return (
    <section aria-label="Find in transcript">
      <h2 className="text-lg font-bold">Find in transcript</h2>
      <p className="mt-1 text-sm text-muted lg:text-sidebar-muted">
        Highlight exact words in the transcript. Instant, no AI.
      </p>

      <div className="relative mt-4">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted lg:text-sidebar-muted"
        />
        <input
          type="search"
          aria-label="Find in transcript"
          placeholder="Find words…"
          value={find.query}
          onChange={(event) => find.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (event.shiftKey) find.previous();
            else find.next();
          }}
          className={cn(
            'h-12 w-full rounded-pill border pr-20 pl-11 text-base transition-colors',
            'border-line-strong bg-surface text-fg placeholder:text-muted focus:border-accent',
            'lg:border-sidebar-line lg:bg-sidebar-hover lg:text-white lg:placeholder:text-sidebar-muted lg:focus:border-sidebar-muted lg:focus-visible:outline-white',
          )}
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2">
          <button
            type="button"
            aria-label="Previous match"
            disabled={total === 0}
            onClick={find.previous}
            className={stepButton}
          >
            <ChevronUp aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next match"
            disabled={total === 0}
            onClick={find.next}
            className={stepButton}
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <p role="status" className="mt-2 px-1 text-sm text-muted lg:text-sidebar-muted">
        {!searching
          ? 'Enter and Shift+Enter jump between matches.'
          : total === 0
            ? 'No matches'
            : `${find.current + 1} of ${total} ${total === 1 ? 'match' : 'matches'}`}
      </p>
    </section>
  );
}
