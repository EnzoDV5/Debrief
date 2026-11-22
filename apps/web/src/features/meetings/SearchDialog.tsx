// The quick search pop-up (also Ctrl+K). It finds meetings, action items and decisions; items and
// decisions open the meeting at the exact transcript line. Arrow keys move, Enter opens.
import { FileText, Gavel, Layers, ListChecks, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Select, type SelectOption } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { formatCalendarDate } from '@/lib/format';
import { useSearch } from './hooks';
import { noteLinkState, type NoteLinkState } from './noteLink';

const CLOSE_MS = 180;

const KINDS = {
  all: 'All',
  meetings: 'Meetings',
  actions: 'Action items',
  decisions: 'Decisions',
} as const;
type Kind = keyof typeof KINDS;
const KIND_OPTIONS: SelectOption<Kind>[] = [
  { value: 'all', label: KINDS.all, icon: <Layers /> },
  { value: 'meetings', label: KINDS.meetings, icon: <FileText /> },
  { value: 'actions', label: KINDS.actions, icon: <ListChecks /> },
  { value: 'decisions', label: KINDS.decisions, icon: <Gavel /> },
];
type Hit = {
  key: string;
  kind: Exclude<Kind, 'all'>;
  group: string;
  icon: ReactNode;
  title: string;
  detail: string;
  to: string;
  // Action items and decisions: which card to highlight on the meeting page.
  state?: NoteLinkState;
};

const lineLink = (meetingId: string, line: number | null) =>
  `/meetings/${meetingId}${line ? `#L${line}` : ''}`;

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [kind, setKind] = useState<Kind>('all');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Wait for a short pause in typing before asking the server.
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searching = term.length >= 2;
  const found = useSearch(searching ? term : '', open);
  // Before typing, each group shows the latest ones, so picking a filter loads that kind at once.
  const label = (name: string) => (searching ? name : `Recent ${name.toLowerCase()}`);
  const allHits: Hit[] = [
    ...(found.data?.meetings ?? []).map((m) => ({
      key: `m-${m.id}`,
      kind: 'meetings' as const,
      group: label('Meetings'),
      icon: <FileText />,
      title: m.title,
      detail: formatCalendarDate(m.meetingDate),
      to: `/meetings/${m.id}`,
    })),
    ...(found.data?.actionItems ?? []).map((a) => ({
      key: `a-${a.id}`,
      kind: 'actions' as const,
      group: label('Action items'),
      icon: <ListChecks />,
      title: a.text,
      detail: [a.owner, a.meetingTitle, a.sourceLine && `line ${a.sourceLine}`]
        .filter(Boolean)
        .join(' · '),
      to: lineLink(a.meetingId, a.sourceLine),
      state: noteLinkState(a.id),
    })),
    ...(found.data?.decisions ?? []).map((d) => ({
      key: `d-${d.id}`,
      kind: 'decisions' as const,
      group: label('Decisions'),
      icon: <Gavel />,
      title: d.text,
      detail: [d.meetingTitle, d.sourceLine && `line ${d.sourceLine}`].filter(Boolean).join(' · '),
      to: lineLink(d.meetingId, d.sourceLine),
      state: noteLinkState(d.id),
    })),
  ];
  const hits = kind === 'all' ? allHits : allHits.filter((hit) => hit.kind === kind);
  const loading = found.isPending;
  const error = found.error;

  const reset = () => {
    setQuery('');
    setTerm('');
    setActive(0);
    setKind('all');
    setClosing(false);
  };
  // Play the exit animation first, then really close the dialog.
  const close = (after?: () => void) => {
    if (closing) return;
    setClosing(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(
      () => {
        reset();
        onClose();
        after?.();
      },
      reduce ? 0 : CLOSE_MS,
    );
  };
  const go = (hit: Hit) => close(() => navigate(hit.to, { state: hit.state }));
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + hits.length) % Math.max(hits.length, 1));
    }
    if (event.key === 'Enter' && hits[active]) go(hits[active]);
  };

  // Keep the highlighted result in view as the arrow keys move.
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listId]);

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={reset}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className={cn(
        'mx-auto mt-[10vh] w-[min(100%-2rem,38rem)] max-w-none overflow-visible bg-transparent p-0 text-fg backdrop:bg-sidebar/50 backdrop:backdrop-blur-sm',
        closing
          ? 'animate-search-out backdrop:animate-fade-out'
          : 'open:motion-safe:animate-search-in open:backdrop:motion-safe:animate-fade-in',
      )}
    >
      {open && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-panel border border-glass-edge glass-float py-1 pr-2 pl-5 shadow-raised">
            <Search aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <input
              autoFocus
              role="combobox"
              aria-label="Search meetings, actions and decisions"
              aria-expanded={hits.length > 0}
              aria-controls={listId}
              aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search meetings, actions and decisions…"
              className="h-12 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted"
            />
            <Select
              label="Show"
              value={kind}
              options={KIND_OPTIONS}
              onChange={(next) => {
                setKind(next);
                setActive(0);
              }}
              className="min-h-9 shadow-none"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => close()}
              className="grid size-9 shrink-0 place-items-center rounded-pill text-muted transition-colors hover:bg-fg/5 hover:text-fg"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="flex h-[min(60vh,30rem)] flex-col overflow-hidden rounded-panel border border-glass-edge glass-float shadow-raised">
            <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto p-2">
              {error ? (
                <p className="px-3 py-4 text-sm text-danger">
                  Couldn&apos;t search: {error.message}
                </p>
              ) : loading ? (
                <p className="px-3 py-4 text-sm text-muted">Searching…</p>
              ) : hits.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">
                  {searching
                    ? `No ${kind === 'all' ? 'results' : KINDS[kind].toLowerCase()} match “${term}”.`
                    : `No ${kind === 'all' ? 'meetings' : KINDS[kind].toLowerCase()} yet.`}
                </p>
              ) : (
                <ul id={listId} role="listbox" aria-label="Results">
                  {hits.map((hit, index) => (
                    <li key={hit.key} role="presentation">
                      {hit.group !== hits[index - 1]?.group && (
                        <p
                          role="presentation"
                          className="px-3 pt-3 pb-1 text-xs font-bold tracking-label text-muted uppercase"
                        >
                          {hit.group}
                        </p>
                      )}
                      <div
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(hit)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                          index === active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'shrink-0 [&>svg]:size-4',
                            index === active ? 'text-accent' : 'text-muted',
                          )}
                        >
                          {hit.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{hit.title}</span>
                          <span className="block truncate text-sm text-muted">{hit.detail}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="flex shrink-0 gap-4 border-t border-line px-5 py-2.5 text-xs text-muted">
              <span>↑ ↓ to move</span>
              <span>Enter to open</span>
              <span>Esc to close</span>
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}
