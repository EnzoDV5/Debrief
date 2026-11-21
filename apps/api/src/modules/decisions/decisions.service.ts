// Rules for decisions. Ones the user added by hand survive a re-analysis.
import type { createDecisionSchema, Decision, DecisionInput } from '@debrief/shared';
import type { z } from 'zod';
import { notFound } from '../../lib/errors';
import { actionItemsRepository } from '../actionItems/actionItems.repository';
import { assertPickedSource } from '../actionItems/pickedSource';
import { toDecision } from '../meetings/meetings.mappers';
import { decisionsRepository } from './decisions.repository';

export const decisionsService = {
  async create(
    userId: string,
    meetingId: string,
    input: z.output<typeof createDecisionSchema>,
  ): Promise<Decision> {
    const lines = await actionItemsRepository.findTranscriptLines(userId, meetingId);
    if (!lines) throw notFound('Meeting');
    assertPickedSource(lines, input.sourceLine);
    const row = await decisionsRepository.create({
      meetingId,
      userId,
      text: input.text,
      sourceLine: input.sourceLine,
      origin: 'manual',
      position: await decisionsRepository.nextPosition(userId, meetingId),
    });
    return toDecision(row);
  },

  async update(userId: string, id: string, input: DecisionInput): Promise<Decision> {
    const current = await decisionsRepository.findForUser(userId, id);
    if (!current) throw notFound('Decision');
    const changed = input.text !== current.text;
    const row = await decisionsRepository.updateForUser(userId, id, {
      text: input.text,
      editedAt: changed ? new Date() : current.editedAt,
    });
    if (!row) throw notFound('Decision');
    return toDecision(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    if (!(await decisionsRepository.deleteForUser(userId, id))) throw notFound('Decision');
  },
};
