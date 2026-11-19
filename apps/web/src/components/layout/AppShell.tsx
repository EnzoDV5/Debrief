import type { AnalysisStatus } from '@debrief/shared';
import {
  Archive,
  Folder,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { useMeetings } from '@/features/meetings/hooks';
import { MeetingMenu } from '@/features/meetings/MeetingMenu';
import { cn } from '@/lib/cn';
import { PanelBackdrop } from './PanelBackdrop';
import { SkipLink } from './SkipLink';

/**
 * Conversation-style workspace: history stays in reach while the current meeting is open.
 * On desktop the page sits in a rounded panel framed by the sidebar colour, and the panel (not
 * the window) scrolls, so the frame and sidebar never move.
 */
export function AppShell() {
  const { mainRef, scrollRef } = useMainFocusOnNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg lg:flex lg:h-dvh lg:bg-sidebar">
      <SkipLink />
      <aside
        aria-label="Workspace sidebar"
        className="hidden w-sidebar shrink-0 flex-col bg-sidebar text-sidebar-fg lg:flex"
      >
        <SidebarContent />
      </aside>
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <header className="sticky top-0 z-20 flex h-topbar items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setMenuOpen(true)}
            className="grid size-10 place-items-center rounded-md text-fg hover:bg-surface-2"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <Link to="/meetings" aria-label="Workspace home">
            <Logo />
          </Link>
        </div>
        <Button
          to="/meetings"
          size="sm"
          icon={<Plus aria-hidden="true" className="size-4" />}
          // Explicit label: a hidden " meeting" span can lose its space ("Newmeeting").
          aria-label="New meeting"
        >
          New
        </Button>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        // Desktop: <main> is the rounded frame (clips the blobs); the div inside it scrolls, so
        // the blobs stay put behind the moving content.
        className="relative min-w-0 outline-none lg:my-5 lg:mr-5 lg:flex-1 lg:overflow-hidden lg:rounded-panel lg:bg-bg"
      >
        <PanelBackdrop />
        <div ref={scrollRef} className="relative lg:scrollbar-panel lg:h-full lg:overflow-y-auto">
          <div className="mx-auto w-full px-4 py-7 sm:px-8 lg:px-8 lg:py-10">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

function useMainFocusOnNavigate() {
  const mainRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname, hash } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
    // On desktop the panel is the scroller, which ScrollRestoration (window only) doesn't reset.
    // A #L12 link scrolls to its own line, so leave those alone.
    if (!hash) scrollRef.current?.scrollTo?.({ top: 0 });
  }, [pathname, hash]);
  return { mainRef, scrollRef };
}

function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    ref.current?.close();
  }, [pathname]);

  return (
    <dialog
      ref={ref}
      aria-label="Workspace sidebar"
      onClose={onClose}
      className="m-0 h-dvh max-h-dvh w-[min(88vw,21rem)] max-w-none bg-sidebar p-0 text-sidebar-fg shadow-raised lg:hidden"
    >
      <SidebarContent onNavigate={onClose} onClose={onClose} />
    </dialog>
  );
}

function SidebarContent({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const { data: meetings, isPending, error, refetch } = useMeetings();
  const pinned = meetings?.filter((meeting) => meeting.pinnedAt) ?? [];
  const recent = meetings?.filter((meeting) => !meeting.pinnedAt) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-18 shrink-0 items-center justify-between px-5">
        <Link to="/meetings" aria-label="Workspace home" onClick={onNavigate}>
          <Logo inverse />
        </Link>
        {onClose && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <div className="px-3 pb-4">
        <NavLink
          to="/meetings"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-md bg-sidebar-hover px-3 text-sm font-semibold text-white transition-colors hover:bg-sidebar-active"
        >
          <Plus aria-hidden="true" className="size-5" />
          New meeting
        </NavLink>
      </div>

      <nav aria-label="Workspace" className="space-y-1 px-3">
        <NavLink to="/search" onClick={onNavigate} className={navClass}>
          <Search aria-hidden="true" className="size-5" />
          Search
        </NavLink>
        <NavLink to="/items" onClick={onNavigate} className={navClass}>
          <ListChecks aria-hidden="true" className="size-5" />
          Action items
        </NavLink>
        <NavLink to="/projects" onClick={onNavigate} className={navClass}>
          <Folder aria-hidden="true" className="size-5" />
          Projects
        </NavLink>
        <NavLink to="/archived" onClick={onNavigate} className={navClass}>
          <Archive aria-hidden="true" className="size-5" />
          Archived
        </NavLink>
      </nav>

      <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-sidebar-line pt-5">
        <div className="flex items-center justify-between px-5">
          <h2 className="text-xs font-bold tracking-label text-sidebar-muted uppercase">
            Recent meetings
          </h2>
          {meetings && (
            <span className="text-xs text-sidebar-muted tabular-nums">{meetings.length}</span>
          )}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {isPending ? (
            <p className="px-3 py-2 text-sm text-sidebar-muted">Loading meetings…</p>
          ) : error ? (
            <div className="px-3 py-2 text-sm text-sidebar-muted">
              <p>Couldn&apos;t load meeting history.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-1 font-semibold text-white underline"
              >
                Try again
              </button>
            </div>
          ) : meetings?.length ? (
            <>
              {pinned.length > 0 && (
                <p className="px-3 pb-1 text-xs font-bold tracking-wide text-sidebar-muted uppercase">
                  Pinned
                </p>
              )}
              {[pinned, recent].map((group, index) => (
                <ul key={index} className="mb-3 space-y-0.5">
                  {group.map((meeting) => (
                    <li
                      key={meeting.id}
                      className="flex items-center rounded-md hover:bg-sidebar-hover"
                    >
                      <NavLink
                        to={`/meetings/${meeting.id}`}
                        onClick={onNavigate}
                        title={meeting.title}
                        className={({ isActive }) =>
                          cn(
                            'flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-sidebar-active text-white'
                              : 'text-sidebar-fg hover:bg-sidebar-hover',
                          )
                        }
                      >
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-pill',
                            statusDot(meeting.analysisStatus),
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{meeting.title}</span>
                      </NavLink>
                      <MeetingMenu meeting={meeting} />
                    </li>
                  ))}
                </ul>
              ))}
            </>
          ) : (
            <p className="px-3 py-2 text-sm text-sidebar-muted">Your meetings will appear here.</p>
          )}
        </div>
      </div>

      <AccountBlock onNavigate={onNavigate} />
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-fg hover:bg-sidebar-hover',
  );
}

function statusDot(status: AnalysisStatus) {
  if (status === 'done') return 'bg-success-soft';
  if (status === 'failed') return 'bg-warning-soft';
  if (status === 'processing') return 'bg-spark';
  return 'bg-sidebar-muted';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function AccountBlock({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <div className="shrink-0 border-t border-sidebar-line p-3">
      <NavLink
        to="/account"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md p-2 transition-colors',
            isActive ? 'bg-sidebar-active' : 'hover:bg-sidebar-hover',
          )
        }
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-pill bg-sidebar-active text-xs font-bold text-white"
        >
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
          <span className="block truncate text-xs text-sidebar-muted">{user.email}</span>
        </span>
        <UserRound aria-hidden="true" className="size-4 text-sidebar-muted" />
      </NavLink>
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => {
              onNavigate?.();
              navigate('/login');
            },
          })
        }
        className="mt-1 flex min-h-9 items-center gap-2 rounded-md px-3 text-sm text-sidebar-muted hover:bg-sidebar-hover hover:text-white disabled:opacity-60"
      >
        <LogOut aria-hidden="true" className="size-4" />
        {logout.isPending ? 'Logging out…' : 'Log out'}
      </button>
    </div>
  );
}
