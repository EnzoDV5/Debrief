import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/usePageTitle';
import { PageBar } from './PageBar';

/**
 * Page title (also sets the tab title), optional description, and actions on the right.
 * Rendered into the shell's page bar (see PageBar), so on desktop it sits on the dark frame above
 * the page panel, like the meeting page's title. Same spacing as MeetingBar, so the panel's top
 * edge stays in the same place when moving between pages.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  usePageTitle(title);
  return (
    <PageBar>
      <header className="flex flex-col gap-4 px-4 pt-7 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-1 lg:pt-0 lg:pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold lg:truncate lg:text-xl lg:text-white">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted lg:text-sidebar-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>
    </PageBar>
  );
}
