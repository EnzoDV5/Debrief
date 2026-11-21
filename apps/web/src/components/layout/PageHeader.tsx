// A page title, description and action buttons, shown in the top bar. Anything passed as
// children (like a filter bar) sits underneath, still outside the page frame.
import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/usePageTitle';
import { PageBar } from './PageBar';

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  usePageTitle(title);
  return (
    <PageBar>
      <header className="flex animate-page-in flex-col gap-4 px-4 pt-7 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-1 lg:pt-0 lg:pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold lg:truncate lg:text-xl lg:text-white">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted lg:text-sidebar-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>
      {children && (
        <div className="animate-page-in px-4 pt-4 sm:px-8 lg:px-1 lg:pt-0 lg:pb-5">{children}</div>
      )}
    </PageBar>
  );
}
