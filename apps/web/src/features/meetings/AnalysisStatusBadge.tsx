// Shows whether a meeting's analysis is waiting, running, done or failed.
import type { AnalysisStatus } from '@debrief/shared';
import { CircleAlert, CircleCheck, Clock, LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/Badge';

const statuses: Record<
  AnalysisStatus,
  { label: string; tone: ComponentProps<typeof Badge>['tone']; icon: React.ReactNode }
> = {
  pending: { label: 'Not analysed yet', tone: 'neutral', icon: <Clock aria-hidden="true" /> },
  processing: {
    label: 'Analysing',
    tone: 'accent',
    icon: <LoaderCircle aria-hidden="true" className="animate-spin" />,
  },
  done: { label: 'Analysed', tone: 'success', icon: <CircleCheck aria-hidden="true" /> },
  failed: { label: 'Analysis failed', tone: 'danger', icon: <CircleAlert aria-hidden="true" /> },
};

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  const { label, tone, icon } = statuses[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}
