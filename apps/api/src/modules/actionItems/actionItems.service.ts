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
import { assertPickedSource } from './pickedSource';

// Business rules for action items. No req/res, no SQL.

type CreateInput = z.output<typeof createActionItemSchema>;
type UpdateInput = z.output<typeof updateActionItemSchema>;
type ListQuery = z.output<typeof actionItemsQuerySchema>;

/** Today's date (UTC) as YYYY-MM-DD, used when the client doesn't send its own "today". */
const utcToday = () => new Date().toISOString().slice(0, 10);

export const actionItemsService = {
  /** A hand-made item: never flagged (the user wrote it), and never replaced by re-analysis. */
  async create(userId: string, meetingId: string, input: CreateInput): Promise<ActionItem> {
    const lines = await actionItemsRepository.findTranscriptLines(userId, meetingId);
    if (!lines) throw notFound('Meeting');
    assertPickedSource(lines, input.sourceLine, input.sourceQuote);
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
    const changes: Parameters<typeof actionItemsRepository.updateForUser>[2] = { ...patch };

    // Once a person has edited what the item says, who owns it or when it's due, they've reviewed
    // it: the AI's warning no longer applies. Just ticking it off (status) doesn't count.
    if ('text' in patch || 'owner' in patch || 'dueDate' in patch) {
      changes.needsReview = false;
      changes.reviewReason = null;
    }
    // A real change to what the item claims. The explanation describes the original task and
    // owner, so it may now be stale; and the card no longer matches its source quote word for
    // word, which editedAt tells the UI.
    if (
      (patch.text !== undefined && patch.text !== current.text) ||
      (patch.owner !== undefined && patch.owner !== current.owner) ||
      (patch.dueDate !== undefined && patch.dueDate !== current.dueDate)
    ) {
      changes.contextSummary = null;
      changes.editedAt = new Date();
    }
    // A *different* date picked by hand replaces the transcript's words for it, so drop those
    // words. An edit form re-sends the unchanged date too; that must keep "next Friday".
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
