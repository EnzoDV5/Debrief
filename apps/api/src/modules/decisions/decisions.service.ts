import type { Decision, DecisionInput } from '@debrief/shared';
import { notFound } from '../../lib/errors';
import { actionItemsRepository } from '../actionItems/actionItems.repository';
import { toDecision } from '../meetings/meetings.mappers';
import { decisionsRepository } from './decisions.repository';

// Business rules for decisions. Hand-added decisions have no source line (nothing to cite) and
// survive a re-analysis, like hand-added action items.

export const decisionsService = {
  async create(userId: string, meetingId: string, input: DecisionInput): Promise<Decision> {
    if (!(await actionItemsRepository.meetingBelongsTo(userId, meetingId))) {
      throw notFound('Meeting');
    }
    const row = await decisionsRepository.create({
      meetingId,
      userId,
      text: input.text,
      origin: 'manual',
      position: await decisionsRepository.nextPosition(userId, meetingId),
    });
    return toDecision(row);
  },

  async update(userId: string, id: string, input: DecisionInput): Promise<Decision> {
    const row = await decisionsRepository.updateForUser(userId, id, input.text);
    if (!row) throw notFound('Decision');
    return toDecision(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    if (!(await decisionsRepository.deleteForUser(userId, id))) throw notFound('Decision');
  },
};
