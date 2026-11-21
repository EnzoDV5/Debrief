// One search across meetings, action items and decisions, all scoped to the user.
import type { SearchResponse } from '@debrief/shared';
import { meetingsService } from '../meetings/meetings.service';
import { searchRepository } from './search.repository';

const MEETING_LIMIT = 6;

export const searchService = {
  async search(userId: string, term?: string): Promise<SearchResponse> {
    const [meetings, actionItems, decisions] = await Promise.all([
      meetingsService.list(userId, term ? { q: term } : {}),
      searchRepository.actionItems(userId, term),
      searchRepository.decisions(userId, term),
    ]);
    return { meetings: meetings.slice(0, MEETING_LIMIT), actionItems, decisions };
  },
};
