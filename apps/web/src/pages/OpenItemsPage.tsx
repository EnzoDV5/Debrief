import { ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

// Phase 4 adds the real list with status, owner and overdue filters.
export function OpenItemsPage() {
  return (
    <>
      <PageHeader
        title="Open items"
        description="Action items from all your meetings that aren't done yet."
      />
      <EmptyState
        icon={<ListChecks />}
        title="Nothing open right now"
        description="Action items from your meetings will collect here, with filters for status, owner and anything overdue."
      />
    </>
  );
}
