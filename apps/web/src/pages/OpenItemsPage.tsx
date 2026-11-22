// "Actions": every action item, filtered by status, owner and overdue, with a scrollable row of
// cards per meeting.
import {
  ACTION_ITEM_STATUS_FILTERS,
  UNASSIGNED_OWNER,
  type ActionItem,
  type ActionItemStatusFilter,
  type ActionItemWithMeeting,
} from '@debrief/shared';
import {
  AlarmClock,
  ArrowUpRight,
  ListChecks,
  SearchX,
  TextQuote,
  Users,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useNavigation, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Carousel } from '@/components/ui/Carousel';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LOAD_ERROR_MESSAGE } from '@/components/ui/ErrorState';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { ActionItemCard, isOverdue } from '@/features/actionItems/ActionItemCard';
import { Initials } from '@/components/ui/Initials';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { DeleteActionItemDialog } from '@/features/actionItems/DeleteActionItemDialog';
import { useActionItems, type ActionItemFilters } from '@/features/actionItems/hooks';
import { noteLinkState } from '@/features/meetings/noteLink';
import { cn } from '@/lib/cn';
import { useLeavingList } from '@/lib/useLeavingList';
import { useLingering } from '@/lib/useLingering';
import { formatCalendarDate, plural } from '@/lib/format';

const STATUS_FILTER_LABELS: Record<ActionItemStatusFilter, string> = {
  open: 'Open',
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  all: 'All',
};

function useFilters(): [ActionItemFilters, (next: Partial<ActionItemFilters>) => void] {
  const [currentParams, setParams] = useSearchParams();
  const location = useLocation();
  const navigation = useNavigation();
  const pending =
    navigation.location?.pathname === location.pathname
      ? new URLSearchParams(navigation.location.search)
      : null;
  const params = pending ?? currentParams;
  const status = params.get('status');
  const filters: ActionItemFilters = {
    status: ACTION_ITEM_STATUS_FILTERS.includes(status as ActionItemStatusFilter)
      ? (status as ActionItemStatusFilter)
      : 'open',
    owner: params.get('owner') || undefined,
    overdue: params.get('overdue') === 'true',
  };
  const update = (next: Partial<ActionItemFilters>) => {
    const merged = { ...filters, ...next };
    const query = new URLSearchParams();
    if (merged.status !== 'open') query.set('status', merged.status);
    if (merged.owner) query.set('owner', merged.owner);
    if (merged.overdue) query.set('overdue', 'true');
    setParams(query, { replace: true });
  };
  return [filters, update];
}

export function OpenItemsPage() {
  const [filters, setFilters] = useFilters();
  const { data, isPending, error, refetch } = useActionItems(filters);
  const [editing, setEditing] = useState<ActionItem | null>(null);
  const [deleting, setDeleting] = useState<ActionItem | null>(null);
  const shownEditing = useLingering(editing);

  const items = data?.actionItems ?? [];
  const filtered = filters.status !== 'open' || Boolean(filters.owner) || filters.overdue;
  const overdueCount = items.filter((item) => isOverdue(item)).length;
  // Ticked-off or deleted items animate out of their row before they go.
  const shownItems = useLeavingList(items, JSON.stringify(filters));
  const groups = groupByMeeting(shownItems);
  const navigate = useNavigate();

  return (
    <div className="lg:flex lg:min-h-full lg:flex-col">
      <PageHeader
        title="Actions"
        description="Every action item from your meetings, grouped by meeting."
      >
        <Filters filters={filters} owners={data?.owners ?? []} onChange={setFilters} />
      </PageHeader>

      {isPending ? (
        <div role="status" aria-label="Loading action items" className="space-y-8">
          {[0, 1].map((i) => (
            <div key={i}>
              <Skeleton className="h-6 w-56" />
              <div className="mt-4 flex gap-4 overflow-hidden">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-40 w-80 shrink-0 rounded-card" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load your action items"
          message={LOAD_ERROR_MESSAGE}
          details={error.message}
          onRetry={() => void refetch()}
        />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX />}
            title="No items match these filters"
            action={
              <Button
                variant="secondary"
                onClick={() => setFilters({ status: 'open', owner: undefined, overdue: false })}
              >
                Clear filters
              </Button>
            }
            variant="plain"
            size="large"
            className="lg:flex-1 lg:justify-center"
          />
        ) : (
          <EmptyState
            icon={<ListChecks />}
            title="Nothing open right now"
            description="Action items from your meetings collect here. Tick them off as they get done."
            action={<Button to="/meetings">Add a meeting</Button>}
            variant="plain"
            size="large"
            className="lg:flex-1 lg:justify-center"
          />
        )
      ) : (
        <>
          <p role="status" className="text-sm text-muted">
            {plural(items.length, 'item')} in {plural(groups.length, 'meeting')}
            {overdueCount > 0 && filters.status !== 'done' && (
              <span className="font-semibold text-danger"> · {overdueCount} overdue</span>
            )}
          </p>
          <div className="mt-6 space-y-10">
            {groups.map((group) => (
              <section key={group.meetingId} aria-label={group.meetingTitle}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <h2 className="min-w-0 text-lg font-bold">{group.meetingTitle}</h2>
                    <Button
                      to={`/meetings/${group.meetingId}`}
                      variant="secondary"
                      size="sm"
                      icon={<ArrowUpRight aria-hidden="true" className="size-4" />}
                      aria-label={`Open ${group.meetingTitle}`}
                    >
                      Open meeting
                    </Button>
                  </div>
                  <p className="text-sm text-muted">
                    {formatCalendarDate(group.meetingDate)} ·{' '}
                    {plural(group.items.filter((item) => !item.leaving).length, 'item')}
                  </p>
                </div>
                <div className="-mx-4 mt-3 sm:-mx-8">
                  <Carousel label={`Actions from ${group.meetingTitle}`}>
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                          navigate(lineLink(item), { state: noteLinkState(item.id) });
                        }}
                        inert={item.leaving}
                        className={cn(
                          // min-h, not h: a card with more to say grows instead of being cut off,
                          // and the carousel (a flex row) stretches the others to match.
                          'min-h-76 w-[min(82vw,22rem)] shrink-0 cursor-pointer snap-start',
                          item.leaving &&
                            'pointer-events-none overflow-hidden motion-safe:animate-card-leave',
                        )}
                      >
                        <ActionItemCard
                          fixed
                          item={item}
                          onEdit={() => setEditing(item)}
                          onDelete={() => setDeleting(item)}
                          source={
                            item.sourceLine ? (
                              <Link
                                to={lineLink(item)}
                                state={noteLinkState(item.id)}
                                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                              >
                                <TextQuote aria-hidden="true" className="size-3.5" />
                                Line {item.sourceLine} in the transcript
                              </Link>
                            ) : (
                              <span className="text-muted">Added by hand</span>
                            )
                          }
                        />
                      </div>
                    ))}
                  </Carousel>
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {shownEditing && (
        <ActionItemDialog
          key={shownEditing.id}
          open={editing !== null}
          onClose={() => setEditing(null)}
          meetingId={shownEditing.meetingId}
          item={shownEditing}
          ownerSuggestions={data?.owners ?? []}
          suggestionsLabel="People from your meetings"
        />
      )}
      <DeleteActionItemDialog item={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

// Clicking a card opens its transcript line, unless the click was on one of its own controls.
const INTERACTIVE = 'button, a, input, select, textarea, label';
const lineLink = (item: ActionItemWithMeeting) =>
  `/meetings/${item.meetingId}${item.sourceLine ? `#L${item.sourceLine}` : ''}`;

// One group per meeting, newest meeting first; items keep the order the server sent.
function groupByMeeting(items: (ActionItemWithMeeting & { leaving?: boolean })[]) {
  const groups = new Map<
    string,
    {
      meetingId: string;
      meetingTitle: string;
      meetingDate: string;
      items: (ActionItemWithMeeting & { leaving?: boolean })[];
    }
  >();
  for (const item of items) {
    const group = groups.get(item.meetingId) ?? {
      meetingId: item.meetingId,
      meetingTitle: item.meetingTitle,
      meetingDate: item.meetingDate,
      items: [],
    };
    group.items.push(item);
    groups.set(item.meetingId, group);
  }
  return [...groups.values()].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

function Filters({
  filters,
  owners,
  onChange,
}: {
  filters: ActionItemFilters;
  owners: string[];
  onChange: (next: Partial<ActionItemFilters>) => void;
}) {
  const ownerOptions: SelectOption<string>[] = [
    { value: '', label: 'Everyone', icon: <Users /> },
    { value: UNASSIGNED_OWNER, label: 'Unassigned', icon: <UserX /> },
    ...owners.map((owner) => ({ value: owner, label: owner, icon: <Initials name={owner} /> })),
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        role="group"
        aria-label="Status"
        className="inline-flex w-fit flex-wrap gap-1 rounded-pill bg-surface p-1 shadow-card ring-1 ring-line lg:bg-sidebar-hover lg:shadow-none lg:ring-sidebar-line"
      >
        {ACTION_ITEM_STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filters.status === status}
            onClick={() => onChange({ status })}
            className={cn(
              'inline-flex min-h-8 items-center rounded-pill px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200',
              filters.status === status
                ? 'bg-fg text-white shadow-card lg:bg-white lg:text-fg'
                : 'text-muted hover:text-fg lg:text-sidebar-muted lg:hover:text-white',
            )}
          >
            {STATUS_FILTER_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          label="Assigned to"
          showLabel
          tone="bar"
          value={filters.owner ?? ''}
          options={ownerOptions}
          onChange={(owner) => onChange({ owner: owner || undefined })}
        />
        <button
          type="button"
          aria-pressed={filters.overdue}
          onClick={() => onChange({ overdue: !filters.overdue })}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-[background-color,border-color,color] duration-200',
            filters.overdue
              ? 'border-danger bg-danger text-white shadow-card'
              : 'border-line-strong/50 bg-surface text-fg shadow-card hover:border-danger/50 hover:text-danger lg:border-sidebar-line lg:bg-sidebar-hover lg:text-sidebar-fg lg:shadow-none lg:hover:text-danger-light',
          )}
        >
          <AlarmClock aria-hidden="true" className="size-4" />
          Overdue only
        </button>
      </div>
    </div>
  );
}
