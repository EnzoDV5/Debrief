import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

/** Small "back" link above a page title. */
export function BackLink() {
  return (
    <Link
      to="/meetings"
      className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Workspace
    </Link>
  );
}
