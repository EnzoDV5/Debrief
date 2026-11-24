// Rules for action items. Editing a flagged item counts as reviewing it, so the flag goes away.
import {
  ACTION_ITEM_STATUSES,
  type ActionItem,
  type ActionItemWithMeeting,
  type createActionItemSchema,
  type actionItemsQuerySchema,
  type updateActionItemSchema,
} from '@debrief/shared';
import type { z } from 'zod';
import { notFound } from '../../lib/errors';
import { toActionItem } from '../meetings/meetings.mappers';
import { actionItemsRepository } from './actionItems.repository';
import { assertNotAnalysing, assertPickedSource } from './pickedSource';

type CreateInput = z.output<typeof createActionItemSchema>;
type UpdateInput = z.output<typeof updateActionItemSchema>;
type ListQuery = z.output<typeof actionItemsQuerySchema>;

const utcToday = () => new Date().toISOString().slice(0, 10);

// Someone else's decision, or one from another meeting, gets the same 404 as one that doesn't
// exist, so decision ids can't be probed.
async function assertDecisionInMeeting(
  userId: string,
  meetingId: string,
  decisionId: string | null | undefined,
) {
  if (!decisionId) return;
  if (!(await actionItemsRepository.decisionIsInMeeting(userId, meetingId, decisionId))) {
    throw notFound('Decision');
  }
}

export const actionItemsService = {
  async create(userId: string, meetingId: string, input: CreateInput): Promise<ActionItem> {
    const meeting = await actionItemsRepository.findForNewNote(userId, meetingId);
    if (!meeting) throw notFound('Meeting');
    assertNotAnalysing(meeting.analysisStatus);
    assertPickedSource(meeting.lines, input.sourceLine, input.sourceQuote);
    await assertDecisionInMeeting(userId, meetingId, input.decisionId);
    const row = await actionItemsRepository.create({
      meetingId,
      userId,
      ...input,
      origin: 'manual',
      position: await actionItemsRepository.nextPosition(userId, meetingId),
    });
    return toActionItem(row);
  },

  async update(userId: string, id: string, patch: UpdateInput): Promise<ActionItem> {
    const current = await actionItemsRepository.findForUser(userId, id);
    if (!current) throw notFound('Action item');
    await assertDecisionInMeeting(userId, current.meetingId, patch.decisionId);
    // Linking to a decision isn't an edit of what the task says, so it doesn't clear the review
    // flag or mark the item as edited (the checks below only look at text, owner and date).
    const changes: Parameters<typeof actionItemsRepository.updateForUser>[2] = { ...patch };

    if ('text' in patch || 'owner' in patch || 'dueDate' in patch) {
      changes.needsReview = false;
      changes.reviewReason = null;
    }
    if (
      (patch.text !== undefined && patch.text !== current.text) ||
      (patch.owner !== undefined && patch.owner !== current.owner) ||
      (patch.dueDate !== undefined && patch.dueDate !== current.dueDate)
    ) {
      changes.contextSummary = null;
      changes.editedAt = new Date();
    }
    if (patch.dueDate !== undefined && patch.dueDate !== current.dueDate) {
      changes.dueDateText = null;
    }

    const row = await actionItemsRepository.updateForUser(userId, id, changes);
    if (!row) throw notFound('Action item');
    return toActionItem(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    if (!(await actionItemsRepository.deleteForUser(userId, id))) throw notFound('Action item');
  },

  async list(
    userId: string,
    query: ListQuery,
  ): Promise<{ actionItems: ActionItemWithMeeting[]; owners: string[] }> {
    const statuses =
      query.status === 'all'
        ? null
        : query.status === 'open'
          ? ACTION_ITEM_STATUSES.filter((s) => s !== 'done')
          : [query.status];

    const [rows, owners] = await Promise.all([
      actionItemsRepository.listForUser(userId, {
        statuses,
        owner: query.owner,
        overdueOn: query.overdue === 'true' ? (query.today ?? utcToday()) : undefined,
      }),
      actionItemsRepository.ownersForUser(userId),
    ]);

    return {
      actionItems: rows.map(({ item, meetingTitle, meetingDate }) => ({
        ...toActionItem(item),
        meetingTitle,
        meetingDate,
      })),
      owners,
    };
  },
};
