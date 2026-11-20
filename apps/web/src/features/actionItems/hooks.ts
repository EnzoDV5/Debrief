import {
  actionItemListResponseSchema,
  actionItemResponseSchema,
  decisionResponseSchema,
  type ActionItem,
  type ActionItemStatusFilter,
  type CreateActionItemInput,
  type Decision,
  type CreateDecisionInput,
  type Meeting,
  type UpdateActionItemInput,
} from '@debrief/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { request, requestNoContent } from '@/api/client';
import { meetingKeys } from '@/features/meetings/hooks';
import { todayDate } from '@/lib/format';

export type ActionItemFilters = {
  status: ActionItemStatusFilter;
  owner?: string;
  overdue: boolean;
};

export const actionItemKeys = {
  all: ['action-items'] as const,
  list: (filters: ActionItemFilters) => ['action-items', filters] as const,
};

/** "My open items": every meeting's action items, filtered on the server. */
export function useActionItems(filters: ActionItemFilters) {
  return useQuery({
    queryKey: actionItemKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams({ status: filters.status, today: todayDate() });
      if (filters.owner) params.set('owner', filters.owner);
      if (filters.overdue) params.set('overdue', 'true');
      return request(`/action-items?${params}`, { schema: actionItemListResponseSchema });
    },
    // Keep showing the previous results while a new filter loads (no flash of empty list).
    placeholderData: (previous) => previous,
  });
}

// ---------------------------------------------------------------------------------------------
// Keeping every cached copy of an item in sync (meeting page + every "open items" filter)
// ---------------------------------------------------------------------------------------------

type ItemUpdate = (item: ActionItem) => ActionItem | null; // null = remove

export function updateItemEverywhere(queryClient: QueryClient, id: string, update: ItemUpdate) {
  const apply = <T extends ActionItem>(items: T[]) =>
    items.flatMap((item) => {
      if (item.id !== id) return [item];
      const next = update(item);
      return next ? [{ ...item, ...next }] : [];
    });

  // Meeting detail caches (the meetings *list* cache is an array, so it's skipped).
  queryClient.setQueriesData<Meeting>({ queryKey: meetingKeys.list }, (data) =>
    data && !Array.isArray(data) && 'actionItems' in data
      ? { ...data, actionItems: apply(data.actionItems) }
      : data,
  );
  queryClient.setQueriesData<{ actionItems: ActionItem[]; owners: string[] }>(
    { queryKey: actionItemKeys.all },
    (data) => (data ? { ...data, actionItems: apply(data.actionItems) } : data),
  );
}

/** Snapshot every cache we're about to touch, so a failed request can be undone exactly. */
async function snapshot(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: actionItemKeys.all });
  await queryClient.cancelQueries({ queryKey: meetingKeys.list });
  return [
    ...queryClient.getQueriesData({ queryKey: actionItemKeys.all }),
    ...queryClient.getQueriesData({ queryKey: meetingKeys.list }),
  ];
}

function restore(queryClient: QueryClient, saved: Awaited<ReturnType<typeof snapshot>>) {
  for (const [key, data] of saved) queryClient.setQueryData(key, data);
}

/**
 * Edit or tick off an item. Optimistic: the screen changes immediately, and if the server says
 * no (offline, validation), the change is rolled back and the error is shown.
 */
export function useUpdateActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateActionItemInput }) =>
      (
        await request(`/action-items/${id}`, {
          method: 'PATCH',
          body: patch,
          schema: actionItemResponseSchema,
        })
      ).actionItem,
    onMutate: async ({ id, patch }) => {
      const saved = await snapshot(queryClient);
      updateItemEverywhere(queryClient, id, (item) => ({
        ...item,
        ...(patch as Partial<ActionItem>),
      }));
      return { saved };
    },
    onError: (_error, _vars, context) => {
      if (context) restore(queryClient, context.saved);
    },
    onSuccess: (item) => updateItemEverywhere(queryClient, item.id, () => item),
    // Filters may no longer match (e.g. a done item in the "open" view): refetch those lists.
    onSettled: () => queryClient.invalidateQueries({ queryKey: actionItemKeys.all }),
  });
}

export function useDeleteActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestNoContent(`/action-items/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      const saved = await snapshot(queryClient);
      updateItemEverywhere(queryClient, id, () => null);
      return { saved };
    },
    onError: (_error, _id, context) => {
      if (context) restore(queryClient, context.saved);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: actionItemKeys.all }),
  });
}

/** Updates one meeting's cached copy (for creating items and editing decisions). */
function updateMeeting(
  queryClient: QueryClient,
  meetingId: string,
  update: (m: Meeting) => Meeting,
) {
  queryClient.setQueryData<Meeting>(meetingKeys.detail(meetingId), (meeting) =>
    meeting ? update(meeting) : meeting,
  );
}

export function useCreateActionItem(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateActionItemInput) =>
      (
        await request(`/meetings/${meetingId}/action-items`, {
          method: 'POST',
          body: input,
          schema: actionItemResponseSchema,
        })
      ).actionItem,
    onSuccess: (item) => {
      updateMeeting(queryClient, meetingId, (m) => ({
        ...m,
        actionItems: [...m.actionItems, item],
      }));
      void queryClient.invalidateQueries({ queryKey: actionItemKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Decisions (only shown on their meeting's page)
// ---------------------------------------------------------------------------------------------

export function useCreateDecision(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDecisionInput) =>
      (
        await request(`/meetings/${meetingId}/decisions`, {
          method: 'POST',
          body: input,
          schema: decisionResponseSchema,
        })
      ).decision,
    onSuccess: (decision) =>
      updateMeeting(queryClient, meetingId, (m) => ({
        ...m,
        decisions: [...m.decisions, decision],
      })),
  });
}

export function useUpdateDecision(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) =>
      (
        await request(`/decisions/${id}`, {
          method: 'PATCH',
          body: { text },
          schema: decisionResponseSchema,
        })
      ).decision,
    onSuccess: (decision: Decision) =>
      updateMeeting(queryClient, meetingId, (m) => ({
        ...m,
        decisions: m.decisions.map((d) => (d.id === decision.id ? decision : d)),
      })),
  });
}

export function useDeleteDecision(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestNoContent(`/decisions/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, id) =>
      updateMeeting(queryClient, meetingId, (m) => ({
        ...m,
        decisions: m.decisions.filter((d) => d.id !== id),
      })),
  });
}
