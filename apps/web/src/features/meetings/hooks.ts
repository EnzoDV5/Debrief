// Data hooks for meetings. Polls while an analysis is running.
import {
  meetingListResponseSchema,
  meetingResponseSchema,
  askMeetingResponseSchema,
  type AskMeetingResponse,
  projectResponseSchema,
  projectsResponseSchema,
  searchResponseSchema,
  archiveAllResponseSchema,
  type Meeting,
  type MeetingListItem,
  type MeetingDetailsInput,
  type UpdateMeetingInput,
  type Project,
} from '@debrief/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { request, requestNoContent } from '@/api/client';

export const meetingKeys = {
  list: ['meetings'] as const,
  filtered: (filter: MeetingFilter) => ['meetings', 'filter', filter] as const,
  detail: (id: string) => ['meetings', id] as const,
};
const projectKeys = ['projects'] as const;

function invalidateMeetingLists(client: ReturnType<typeof useQueryClient>) {
  return client.invalidateQueries({
    queryKey: meetingKeys.list,
    predicate: (query) => query.queryKey.length === 1 || query.queryKey[1] === 'filter',
  });
}

export type MeetingFilter = { archived?: boolean; q?: string; projectId?: string };

export function useMeetings(filter: MeetingFilter = {}, enabled = true) {
  const params = new URLSearchParams();
  if (filter.archived) params.set('archived', 'true');
  if (filter.q) params.set('q', filter.q);
  if (filter.projectId) params.set('projectId', filter.projectId);
  return useQuery({
    queryKey: Object.keys(filter).length ? meetingKeys.filtered(filter) : meetingKeys.list,
    enabled,
    queryFn: async () =>
      (
        await request(`/meetings${params.size ? `?${params}` : ''}`, {
          schema: meetingListResponseSchema,
        })
      ).meetings,
    // While any meeting is being analysed, keep checking, wherever you are in the app, so the
    // sidebar and the "done" notification update without you staying on that meeting.
    refetchInterval: (query) =>
      query.state.data?.some(
        (meeting) =>
          meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing',
      )
        ? 3_000
        : false,
  });
}

async function fetchMeeting(queryClient: QueryClient, id: string) {
  const meeting = (await request(`/meetings/${id}`, { schema: meetingResponseSchema })).meeting;
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
}

// While the next meeting loads, the previous one stays on screen (marked as placeholder), so
// switching meetings never flashes an empty page.
export function useMeeting(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: () => fetchMeeting(queryClient, id),
    placeholderData: (previous) => previous,
    refetchInterval: (query) =>
      query.state.data?.analysisStatus === 'pending' ||
      query.state.data?.analysisStatus === 'processing'
        ? 2_000
        : false,
  });
}

export function usePrefetchMeeting() {
  const queryClient = useQueryClient();
  return (id: string) =>
    void queryClient.prefetchQuery({
      queryKey: meetingKeys.detail(id),
      queryFn: () => fetchMeeting(queryClient, id),
    });
}

export function useUpdateTranscriptLine(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ n, text }: { n: number; text: string }) =>
      (
        await request(`/meetings/${meetingId}/lines/${n}`, {
          method: 'PATCH',
          body: { text },
          schema: meetingResponseSchema,
        })
      ).meeting,
    onSuccess: (meeting) => queryClient.setQueryData(meetingKeys.detail(meetingId), meeting),
  });
}

// Search across meetings, action items and decisions. With no term it returns the latest of each
// (so a filter shows something before you type); a single character waits for a second.
export function useSearch(term: string, enabled = true) {
  return useQuery({
    queryKey: ['search', term],
    queryFn: () =>
      request(term ? `/search?${new URLSearchParams({ q: term })}` : '/search', {
        schema: searchResponseSchema,
      }),
    enabled: enabled && term.length !== 1,
    placeholderData: (previous) => previous,
  });
}

// Saves a new sidebar order for one section (meeting ids, top to bottom). The list is reordered
// in the cache first, so the sidebar updates instantly; if the save fails, the real order is
// fetched again.
export function useReorderMeetings() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (ids: string[]) =>
      requestNoContent('/meetings/order', { method: 'PUT', body: { ids } }),
    onError: () => void invalidateMeetingLists(queryClient),
  });
  return (ids: string[]) => {
    queryClient.setQueryData<MeetingListItem[]>(meetingKeys.list, (list) => {
      if (!list) return list;
      const byId = new Map(list.map((meeting) => [meeting.id, meeting]));
      const reordered = ids.map((id) => byId.get(id)).filter((m) => m !== undefined);
      let next = 0;
      return list.map((meeting) => (ids.includes(meeting.id) ? reordered[next++]! : meeting));
    });
    mutation.mutate(ids);
  };
}

// Clears the sidebar's Meetings list by archiving every unpinned meeting (nothing is deleted).
export function useArchiveAllMeetings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await request('/meetings/archive-all', { method: 'POST', schema: archiveAllResponseSchema }))
        .archived,
    onSuccess: () => {
      void invalidateMeetingLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['action-items'] });
    },
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
      void invalidateMeetingLists(queryClient);
    },
  });
}

export function useAskMeeting(id: string) {
  return useMutation({
    mutationFn: async (question: string): Promise<AskMeetingResponse> =>
      request(`/meetings/${id}/ask`, {
        method: 'POST',
        body: { question },
        schema: askMeetingResponseSchema,
      }),
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
      queryClient.setQueryData(meetingKeys.detail(meeting.id), meeting);
      void invalidateMeetingLists(queryClient);
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
    onSuccess: (meeting, patch) => {
      queryClient.setQueryData(meetingKeys.detail(id), meeting);
      void invalidateMeetingLists(queryClient);
      if (patch.projectId !== undefined || patch.archived !== undefined)
        void queryClient.invalidateQueries({ queryKey: projectKeys });
    },
  });
}

export function useDeleteMeeting(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestNoContent(`/meetings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: meetingKeys.detail(id) });
      void invalidateMeetingLists(queryClient);
      // Its action items are gone too (the Actions page and its count badge).
      void queryClient.invalidateQueries({ queryKey: ['action-items'] });
      void queryClient.invalidateQueries({ queryKey: projectKeys });
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys,
    queryFn: async () => (await request('/projects', { schema: projectsResponseSchema })).projects,
  });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Project> =>
      (
        await request('/projects', {
          method: 'POST',
          body: { name },
          schema: projectResponseSchema,
        })
      ).project,
    onSuccess: () => void client.invalidateQueries({ queryKey: projectKeys }),
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<Project> =>
      (
        await request(`/projects/${id}`, {
          method: 'PATCH',
          body: { name },
          schema: projectResponseSchema,
        })
      ).project,
    onSuccess: () => void client.invalidateQueries({ queryKey: projectKeys }),
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => requestNoContent(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKeys });
      void invalidateMeetingLists(client);
    },
  });
}
