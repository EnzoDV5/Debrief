// The 404 page.
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { usePageTitle } from '@/lib/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <main id="main" className="flex min-h-dvh flex-col px-4 py-8 sm:px-6">
      <Link to="/" aria-label="Debrief home" className="self-start">
        <Logo />
      </Link>
      <div className="m-auto max-w-md text-center">
        <p className="eyebrow text-accent">Error 404</p>
        <h1 className="mt-3 text-2xl font-bold">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-muted">The link may be broken, or the page may have moved.</p>
        <Button to="/" className="mt-8">
          Go to Debrief
        </Button>
      </div>
    </main>
  );
}
