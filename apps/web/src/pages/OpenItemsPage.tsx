// "My open items" across all meetings, filtered by status, owner and overdue.
import {
  ACTION_ITEM_STATUS_FILTERS,
  UNASSIGNED_OWNER,
  type ActionItem,
  type ActionItemStatusFilter,
} from '@debrief/shared';
import { ListChecks, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigation, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ActionItemCard, isOverdue } from '@/features/actionItems/ActionItemCard';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { DeleteActionItemDialog } from '@/features/actionItems/DeleteActionItemDialog';
import { useActionItems, type ActionItemFilters } from '@/features/actionItems/hooks';
import { cn } from '@/lib/cn';
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

  const items = data?.actionItems ?? [];
  const filtered = filters.status !== 'open' || Boolean(filters.owner) || filters.overdue;
  const overdueCount = items.filter((item) => isOverdue(item)).length;

  return (
    <>
      <PageHeader
        title="Action items"
        description="Every action item from all your meetings, in one list."
      />

      <Filters filters={filters} owners={data?.owners ?? []} onChange={setFilters} />

      {isPending ? (
        <div role="status" aria-label="Loading action items" className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          className="mt-6"
          title="Couldn't load your action items"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            className="mt-6"
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
          />
        ) : (
          <EmptyState
            className="mt-6"
            icon={<ListChecks />}
            title="Nothing open right now"
            description="Action items from your meetings collect here. Tick them off as they get done."
            action={<Button to="/meetings/new">Add a meeting</Button>}
          />
        )
      ) : (
        <>
          <p role="status" className="mt-6 text-sm text-muted">
            {plural(items.length, 'item')}
            {overdueCount > 0 && filters.status !== 'done' && (
              <span className="font-semibold text-danger"> · {overdueCount} overdue</span>
            )}
          </p>
          <ol className="mt-3 space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <ActionItemCard
                  item={item}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setDeleting(item)}
                  source={
                    <Link
                      to={`/meetings/${item.meetingId}${item.sourceLine ? `#L${item.sourceLine}` : ''}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {item.meetingTitle}
                      <span className="font-normal text-muted">
                        {' '}
                        · {formatCalendarDate(item.meetingDate)}
                        {item.sourceLine && ` · Line ${item.sourceLine}`}
                      </span>
                    </Link>
                  }
                />
              </li>
            ))}
          </ol>
        </>
      )}

      {editing && (
        <ActionItemDialog
          open
          onClose={() => setEditing(null)}
          meetingId={editing.meetingId}
          item={editing}
          ownerSuggestions={data?.owners ?? []}
        />
      )}
      <DeleteActionItemDialog item={deleting} onClose={() => setDeleting(null)} />
    </>
  );
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
  return (
    <div className="flex flex-col gap-4 rounded-card border border-white/70 glass p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
        {ACTION_ITEM_STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filters.status === status}
            onClick={() => onChange({ status })}
            className={cn(
              'inline-flex min-h-10 items-center rounded-pill border px-4 text-sm font-semibold transition-colors',
              filters.status === status
                ? 'border-fg bg-fg text-white'
                : 'border-line-strong/60 text-fg hover:border-fg',
            )}
          >
            {STATUS_FILTER_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Owner
          <select
            value={filters.owner ?? ''}
            onChange={(event) => onChange({ owner: event.target.value || undefined })}
            className="min-h-10 rounded-md border border-line-strong bg-surface px-3 text-sm font-normal"
          >
            <option value="">Everyone</option>
            <option value={UNASSIGNED_OWNER}>No owner</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={(event) => onChange({ overdue: event.target.checked })}
            className="size-4 accent-accent"
          />
          Overdue only
        </label>
      </div>
    </div>
  );
}
