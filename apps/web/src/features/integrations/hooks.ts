import { addToCalendarResponseSchema, calendarStatusSchema } from '@debrief/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestNoContent } from '@/api/client';
import { updateItemEverywhere } from '@/features/actionItems/hooks';

export const calendarKeys = { status: ['integrations', 'google'] as const };

/** Is Google Calendar available on this server, and has this user connected it? */
export function useCalendarStatus() {
  return useQuery({
    queryKey: calendarKeys.status,
    queryFn: () => request('/integrations/google', { schema: calendarStatusSchema }),
    staleTime: 5 * 60_000, // changes only when the user connects/disconnects
  });
}

/**
 * Connecting is a full-page trip to Google and back (OAuth needs the browser to visit Google
 * itself), so it's a plain navigation, not a fetch. The api redirects to Google, Google redirects
 * back to /account?calendar=connected.
 */
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
      // Access was removed in Google: refresh the status so the UI offers "Connect" again.
      if ('code' in error && error.code === 'CALENDAR_RECONNECT') {
        void queryClient.invalidateQueries({ queryKey: calendarKeys.status });
      }
    },
  });
}
