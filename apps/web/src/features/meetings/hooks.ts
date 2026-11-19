import {
  meetingListResponseSchema,
  meetingResponseSchema,
  type Meeting,
  type MeetingDetailsInput,
  type UpdateMeetingInput,
} from '@debrief/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestNoContent } from '@/api/client';

// Query keys: the list and each meeting are cached separately.
export const meetingKeys = {
  list: ['meetings'] as const,
  detail: (id: string) => ['meetings', id] as const,
};

export function useMeetings() {
  return useQuery({
    queryKey: meetingKeys.list,
    queryFn: async () =>
      (await request('/meetings', { schema: meetingListResponseSchema })).meetings,
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: async () =>
      (await request(`/meetings/${id}`, { schema: meetingResponseSchema })).meeting,
  });
}

export type CreateMeetingInput =
  | (MeetingDetailsInput & { source: 'paste'; transcript: string })
  | (MeetingDetailsInput & { source: 'upload'; file: File });

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMeetingInput): Promise<Meeting> => {
      const { title, meetingDate } = input;
      let body: FormData | object;
      if (input.source === 'upload') {
        // Multipart form: the file plus its details as ordinary form fields.
        const form = new FormData();
        form.append('title', title);
        form.append('meetingDate', meetingDate);
        form.append('file', input.file);
        body = form;
      } else {
        body = { title, meetingDate, transcript: input.transcript };
      }
      return (await request('/meetings', { method: 'POST', body, schema: meetingResponseSchema }))
        .meeting;
    },
    onSuccess: (meeting) => {
      // The detail page opens instantly from cache; the list refetches when next shown.
      queryClient.setQueryData(meetingKeys.detail(meeting.id), meeting);
      void queryClient.invalidateQueries({ queryKey: meetingKeys.list, exact: true });
    },
  });
}

export function useUpdateMeeting(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UpdateMeetingInput) =>
      (
        await request(`/meetings/${id}`, {
          method: 'PATCH',
          body: patch,
          schema: meetingResponseSchema,
        })
      ).meeting,
    onSuccess: (meeting) => {
      queryClient.setQueryData(meetingKeys.detail(id), meeting);
      void queryClient.invalidateQueries({ queryKey: meetingKeys.list, exact: true });
    },
  });
}

export function useDeleteMeeting(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestNoContent(`/meetings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: meetingKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: meetingKeys.list, exact: true });
    },
  });
}
