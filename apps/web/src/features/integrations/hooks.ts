// Data hooks for Google Calendar.
import { addToCalendarResponseSchema, calendarStatusSchema } from '@debrief/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestNoContent } from '@/api/client';
import { updateItemEverywhere } from '@/features/actionItems/hooks';

export const calendarKeys = { status: ['integrations', 'google'] as const };

export function useCalendarStatus() {
  return useQuery({
    queryKey: calendarKeys.status,
    queryFn: () => request('/integrations/google', { schema: calendarStatusSchema }),
    staleTime: 5 * 60_000,
  });
}

export const CONNECT_CALENDAR_URL = '/api/integrations/google/connect';

export function useDisconnectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestNoContent('/integrations/google', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKeys.status }),
  });
}

export function useAddToCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      request(`/action-items/${itemId}/calendar`, {
        method: 'POST',
        schema: addToCalendarResponseSchema,
      }),
    onSuccess: ({ actionItem }) =>
      updateItemEverywhere(queryClient, actionItem.id, () => actionItem),
    onError: (error) => {
      if ('code' in error && error.code === 'CALENDAR_RECONNECT') {
        void queryClient.invalidateQueries({ queryKey: calendarKeys.status });
      }
    },
  });
}
