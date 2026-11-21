// Data hooks for action items. Ticking one off updates the screen straight away.
import {
  UNASSIGNED_OWNER,
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

export function useActionItems(filters: ActionItemFilters) {
  return useQuery({
    queryKey: actionItemKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams({ status: filters.status, today: todayDate() });
      if (filters.owner) params.set('owner', filters.owner);
      if (filters.overdue) params.set('overdue', 'true');
      return request(`/action-items?${params}`, { schema: actionItemListResponseSchema });
    },
    placeholderData: (previous) => previous,
  });
}

type ItemUpdate = (item: ActionItem) => ActionItem | null;

export function updateItemEverywhere(queryClient: QueryClient, id: string, update: ItemUpdate) {
  const apply = <T extends ActionItem>(items: T[]) =>
    items.flatMap((item) => {
      if (item.id !== id) return [item];
      const next = update(item);
      return next ? [{ ...item, ...next }] : [];
    });

  queryClient.setQueriesData<Meeting>({ queryKey: meetingKeys.list }, (data) =>
    data && !Array.isArray(data) && 'actionItems' in data
      ? { ...data, actionItems: apply(data.actionItems) }
      : data,
  );
  // Each Actions-page list also drops an item that no longer fits its filter (e.g. ticked off
  // while showing "Open"), so it leaves straight away instead of on the next refresh.
  for (const [key, data] of queryClient.getQueriesData<{
    actionItems: ActionItem[];
    owners: string[];
  }>({ queryKey: actionItemKeys.all })) {
    if (!data) continue;
    const filters = key[1] as ActionItemFilters | undefined;
    queryClient.setQueryData(key, {
      ...data,
      actionItems: apply(data.actionItems).filter((item) => !filters || fitsFilters(item, filters)),
    });
  }
}

function fitsFilters(item: ActionItem, filters: ActionItemFilters) {
  const status =
    filters.status === 'all' ||
    (filters.status === 'open' ? item.status !== 'done' : item.status === filters.status);
  const owner =
    !filters.owner ||
    (filters.owner === UNASSIGNED_OWNER
      ? item.owner === null
      : item.owner?.toLowerCase() === filters.owner.toLowerCase());
  const overdue =
    !filters.overdue ||
    (item.status !== 'done' && item.dueDate !== null && item.dueDate < todayDate());
  return status && owner && overdue;
}

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
