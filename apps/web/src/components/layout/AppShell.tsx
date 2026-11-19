import { FileText, ListChecks, LogOut, Plus, UserRound, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { cn } from '@/lib/cn';
import { SkipLink } from './SkipLink';

type NavItem = { to: string; label: string; icon: LucideIcon };

const primaryNav: NavItem[] = [
  { to: '/meetings', label: 'Meetings', icon: FileText },
  { to: '/items', label: 'Open items', icon: ListChecks },
];
const mobileTabs: NavItem[] = [
  ...primaryNav,
  { to: '/account', label: 'Account', icon: UserRound },
];

/**
 * Logged-in layout.
 * Desktop (lg+): fixed sidebar with navigation, the main action and the account block.
 * Mobile: slim top bar (logo + New meeting) and a bottom tab bar in thumb reach.
 */
export function AppShell() {
  const mainRef = useMainFocusOnNavigate();

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <Sidebar />
      <MobileTopBar />

      <main id="main" ref={mainRef} tabIndex={-1} className="outline-none lg:pl-sidebar">
        {/* Bottom padding on mobile leaves room for the tab bar and the iPhone home indicator. */}
        <div className="mx-auto w-full max-w-content px-4 pt-6 pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+1.5rem)] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <Outlet />
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}

/**
 * In a single-page app the browser doesn't reset focus on navigation, so keyboard and
 * screen-reader users would stay on the link they clicked. Move focus to the new page instead.
 */
function useMainFocusOnNavigate() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // Compare with the previous path (not a "first render" flag): React StrictMode runs effects
  // twice on mount in development, which would otherwise steal focus on page load.
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    // preventScroll: <ScrollRestoration> in routes.tsx owns the scroll position.
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return mainRef;
}

function navLinkClasses({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors',
    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <div className="px-4 pt-2 pb-4">
        <Button to="/meetings/new" fullWidth icon={<Plus aria-hidden="true" className="size-4" />}>
          New meeting
        </Button>
      </div>

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              {/* Meetings stays highlighted on every /meetings/... page (new, detail);
                  the other links only on their exact path. */}
              <NavLink to={to} end={to !== '/meetings'} className={navLinkClasses}>
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <AccountBlock />
    </aside>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function AccountBlock() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="border-t border-line p-3">
      <NavLink
        to="/account"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md p-2 transition-colors',
            isActive ? 'bg-accent-soft' : 'hover:bg-surface-2',
          )
        }
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-pill bg-fg text-xs font-bold text-white"
        >
          {initials(user.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
      </NavLink>
      <Button
        variant="ghost"
        size="sm"
        // Not full width, so it sits left under the account row without overriding `justify`.
        className="mt-1 text-muted"
        loading={logout.isPending}
        icon={<LogOut aria-hidden="true" className="size-4" />}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
      >
        Log out
      </Button>
    </div>
  );
}

function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
      <Logo />
      <Button to="/meetings/new" size="sm" icon={<Plus aria-hidden="true" className="size-4" />}>
        New
        <span className="sr-only"> meeting</span>
      </Button>
    </header>
  );
}

function MobileTabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid h-tabbar grid-cols-3">
        {mobileTabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to !== '/meetings'}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors',
                  isActive ? 'text-accent' : 'text-muted hover:text-fg',
                )
              }
            >
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
