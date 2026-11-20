import type { ActionItem, Decision, Meeting, MeetingListItem } from '@debrief/shared';
import type { ActionItemRow, DecisionRow, MeetingRow } from '../../db/schema';
import type { MeetingListRow } from './meetings.repository';

// Database rows → api responses. Kept in one place so dates are always ISO strings and internal
// columns (user_id, transcript_original, timestamps) never leak into responses by accident.

export function toListItem(row: MeetingListRow): MeetingListItem {
  return {
    id: row.id,
    title: row.title,
    meetingDate: row.meetingDate,
    sourceType: row.sourceType,
    analysisStatus: row.analysisStatus,
    lineCount: row.lineCount,
    createdAt: row.createdAt.toISOString(),
    pinnedAt: row.pinnedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    projectId: row.projectId,
  };
}

export function toDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    text: row.text,
    sourceLine: row.sourceLine,
    position: row.position,
    editedAt: row.editedAt?.toISOString() ?? null,
  };
}

export function toActionItem(row: ActionItemRow): ActionItem {
  return {
    id: row.id,
    meetingId: row.meetingId,
    text: row.text,
    owner: row.owner,
    dueDate: row.dueDate,
    dueDateText: row.dueDateText,
    status: row.status,
    needsReview: row.needsReview,
    reviewReason: row.reviewReason,
    sourceLine: row.sourceLine,
    sourceQuote: row.sourceQuote,
    contextSummary: row.contextSummary,
    inCalendar: row.calendarEventId !== null,
    origin: row.origin,
    position: row.position,
    editedAt: row.editedAt?.toISOString() ?? null,
  };
}

export function toMeeting(
  row: MeetingRow,
  results: { decisions: DecisionRow[]; actionItems: ActionItemRow[] },
): Meeting {
  return {
    ...toListItem({ ...row, lineCount: row.transcriptLines.length }),
    transcriptLines: row.transcriptLines,
    summary: row.summary,
    analysisError: row.analysisError,
    decisions: results.decisions.map(toDecision),
    actionItems: results.actionItems.map(toActionItem),
    updatedAt: row.updatedAt.toISOString(),
  };
}
