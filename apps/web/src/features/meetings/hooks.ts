import {
  meetingListResponseSchema,
  meetingResponseSchema,
  type Meeting,
  type MeetingListItem,
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
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: async () => {
      const meeting = (await request(`/meetings/${id}`, { schema: meetingResponseSchema })).meeting;
      // The sidebar stays mounted while detail polling runs; keep its status and title current.
      queryClient.setQueryData<MeetingListItem[]>(meetingKeys.list, (list) => {
        if (!list) return list;
        return list.map((item) =>
          item.id === id &&
          (item.analysisStatus !== meeting.analysisStatus || item.title !== meeting.title)
            ? { ...item, analysisStatus: meeting.analysisStatus, title: meeting.title }
            : item,
        );
      });
      return meeting;
    },
    // Stop polling once the worker has a final result; no refresh is needed for a finished page.
    refetchInterval: (query) =>
      query.state.data?.analysisStatus === 'pending' ||
      query.state.data?.analysisStatus === 'processing'
        ? 2_000
        : false,
  });
}

export function useAnalyzeMeeting(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (
        await request(`/meetings/${id}/analyze`, {
          method: 'POST',
          schema: meetingResponseSchema,
        })
      ).meeting,
    onSuccess: (meeting) => {
      queryClient.setQueryData(meetingKeys.detail(id), meeting);
      void queryClient.invalidateQueries({ queryKey: meetingKeys.list, exact: true });
    },
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
