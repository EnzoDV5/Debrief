import {
  Archive,
  Folder,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
import { PageBarSlot, PanelOverlaySlot } from './PageBar';
import { PanelBackdrop } from './PanelBackdrop';
import { ShellFrameContext, type ShellFrameClasses } from './shellFrame';
import { SkipLink } from './SkipLink';

const COLLAPSED_KEY = 'debrief.sidebarCollapsed';

/** The sidebar's collapsed state, remembered in this browser (a per-viewer preference). */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false; // storage blocked (private mode): just start expanded
    }
  });
  const toggle = () =>
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? '0' : '1');
      } catch {
        // Not remembered, but the toggle still works for this visit.
      }
      return !current;
    });
  return { collapsed, toggle };
}

/**
 * Conversation-style workspace: history stays in reach while the current meeting is open.
 * On desktop the page sits in a rounded panel framed by the sidebar colour, and the panel (not
 * the window) scrolls, so the frame and sidebar never move. The sidebar can collapse to icons,
 * and the panel grows into the space. A page can put a bar above the panel (see PageBar) or pull
 * the panel in from the right to make room beside it (see shellFrame.ts).
 */
export function AppShell() {
  const { mainRef, scrollRef } = useMainFocusOnNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  // State (not a ref) so pages re-render with the element once it exists.
  const [pageBarSlot, setPageBarSlot] = useState<HTMLDivElement | null>(null);
  const [panelOverlay, setPanelOverlay] = useState<HTMLDivElement | null>(null);
  // Classes from a page that narrows the panel (the meeting page), or null for full width.
  const [frame, setFrame] = useState<ShellFrameClasses | null>(null);
  const panelInset = frame?.panel ?? null;
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh bg-bg lg:flex lg:h-dvh lg:bg-sidebar">
      <SkipLink />
      <aside
        id="workspace-sidebar"
        aria-label="Workspace sidebar"
        className={cn(
          'hidden shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-fg transition-[width] duration-300 ease-out-3 lg:flex',
          collapsed ? 'w-rail' : 'w-sidebar',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={toggle} />
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
        className="min-w-0 outline-none lg:my-5 lg:mr-5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
      >
        {/* Page bar slot: empty (no height) unless the page fills it. Layered above the page
            (z-30), so its menus open over the content (e.g. the Ask card) and the mobile
            backdrop, which comes later in the DOM, doesn't paint over it. */}
        <div ref={setPageBarSlot} className="relative z-30" />
        <div
          className={cn(
            'relative lg:min-h-0 lg:flex-1',
            // Full-width panel: clip the content to its rounded corners. A narrowed panel can't,
            // since the page's notes column sits outside it.
            !panelInset && 'lg:overflow-hidden lg:rounded-panel',
          )}
        >
          {/* Desktop: the rounded panel, drawn behind the scrolling content, so its corners stay
              round while the page scrolls. It slides when a page narrows or releases it. */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 hidden overflow-hidden rounded-panel bg-bg transition-[right] duration-500 ease-panel lg:block',
              panelInset,
            )}
          >
            <PanelBackdrop contained />
          </div>
          {/* Mobile: no panel; the blobs sit fixed behind the whole page. */}
          <div className="lg:hidden">
            <PanelBackdrop />
          </div>
          <div
            ref={scrollRef}
            // Lets a page find the scrolling area (e.g. the transcript map follows its scroll).
            data-scroller=""
            className={cn(
              'relative lg:scrollbar-panel lg:h-full lg:overflow-y-auto',
              // Beside a narrowed panel the scrollbar is on the dark frame: tint it light, and
              // always reserve its width so the page can line up with the panel's edge.
              panelInset && 'lg:[scrollbar-gutter:stable] lg:text-sidebar-muted',
              frame?.scroller,
            )}
          >
            <div
              className={cn('w-full', !panelInset && 'mx-auto px-4 py-7 sm:px-8 lg:px-8 lg:py-10')}
            >
              <ShellFrameContext.Provider value={setFrame}>
                <PageBarSlot.Provider value={pageBarSlot}>
                  <PanelOverlaySlot.Provider value={panelOverlay}>
                    {/* Keyed by path, so each newly opened page plays its fade-in while the
                        panel slides to the new page's width. */}
                    <div key={pathname} className="animate-page-in">
                      <Outlet />
                    </div>
                  </PanelOverlaySlot.Provider>
                </PageBarSlot.Provider>
              </ShellFrameContext.Provider>
            </div>
          </div>
          {/* Desktop: a layer the same size as the panel, over the scrolling content, for things
              that stay fixed on the panel (PanelOverlay). Clicks pass through it except where a
              page puts something. */}
          <div
            ref={setPanelOverlay}
            className={cn(
              'pointer-events-none absolute inset-0 z-10 hidden transition-[right] duration-500 ease-panel lg:block',
              panelInset,
            )}
          />
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

/**
 * Collapsed (desktop only): icons only. Each label stays in the page for screen readers
 * (sr-only) and shows as a tooltip; the meeting history is hidden until it's expanded again.
 */
function SidebarContent({
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { data: meetings, isPending, error, refetch } = useMeetings();
  const pinned = meetings?.filter((meeting) => meeting.pinnedAt) ?? [];
  const recent = meetings?.filter((meeting) => !meeting.pinnedAt) ?? [];
  const label = (text: string) => <span className={cn(collapsed && 'sr-only')}>{text}</span>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0',
          collapsed
            ? 'flex-col items-center gap-2 py-4'
            : 'h-18 items-center justify-between pr-3 pl-5',
        )}
      >
        <Link to="/meetings" aria-label="Workspace home" onClick={onNavigate}>
          <Logo inverse markOnly={collapsed} />
        </Link>
        {onToggleCollapsed && (
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="workspace-sidebar"
            onClick={onToggleCollapsed}
            className="grid size-9 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white focus-visible:outline-white"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-5" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-5" />
            )}
          </button>
        )}
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
          title={collapsed ? 'New meeting' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-md bg-sidebar-hover text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-sidebar-active',
            collapsed ? 'justify-center' : 'px-3',
          )}
        >
          <Plus aria-hidden="true" className="size-5 shrink-0" />
          {label('New meeting')}
        </NavLink>
      </div>

      <nav aria-label="Workspace" className="space-y-1 px-3">
        {(
          [
            ['/search', Search, 'Search'],
            ['/items', ListChecks, 'Action items'],
            ['/projects', Folder, 'Projects'],
            ['/archived', Archive, 'Archived'],
          ] as const
        ).map(([to, Icon, text]) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? text : undefined}
            className={({ isActive }) => navClass(isActive, collapsed)}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            {label(text)}
          </NavLink>
        ))}
      </nav>

      {collapsed ? (
        <div className="flex-1" />
      ) : (
        <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-sidebar-line pt-5">
          <div className="flex items-center justify-between px-5">
            <h2 className="text-xs font-bold tracking-label whitespace-nowrap text-sidebar-muted uppercase">
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
                          <span className="min-w-0 flex-1 truncate">{meeting.title}</span>
                        </NavLink>
                        <MeetingMenu meeting={meeting} />
                      </li>
                    ))}
                  </ul>
                ))}
              </>
            ) : (
              <p className="px-3 py-2 text-sm text-sidebar-muted">
                Your meetings will appear here.
              </p>
            )}
          </div>
        </div>
      )}

      <AccountBlock onNavigate={onNavigate} collapsed={collapsed} />
    </div>
  );
}

function navClass(isActive: boolean, collapsed: boolean) {
  return cn(
    'flex min-h-10 items-center gap-3 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
    collapsed ? 'justify-center' : 'px-3',
    isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-fg hover:bg-sidebar-hover',
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function AccountBlock({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <div className={cn('shrink-0 border-t border-sidebar-line p-3', collapsed && 'px-2')}>
      <NavLink
        to="/account"
        onClick={onNavigate}
        title={collapsed ? `${user.name} (account)` : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md p-2 transition-colors',
            collapsed && 'justify-center',
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
        <span className={cn('min-w-0 flex-1', collapsed && 'sr-only')}>
          <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
          <span className="block truncate text-xs text-sidebar-muted">{user.email}</span>
        </span>
        {!collapsed && <UserRound aria-hidden="true" className="size-4 text-sidebar-muted" />}
      </NavLink>
      <button
        type="button"
        disabled={logout.isPending}
        title={collapsed ? 'Log out' : undefined}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => {
              onNavigate?.();
              navigate('/login');
            },
          })
        }
        className={cn(
          'mt-1 flex min-h-9 w-full items-center gap-2 rounded-md text-sm whitespace-nowrap text-sidebar-muted hover:bg-sidebar-hover hover:text-white disabled:opacity-60',
          collapsed ? 'justify-center' : 'px-3',
        )}
      >
        <LogOut aria-hidden="true" className="size-4 shrink-0" />
        <span className={cn(collapsed && 'sr-only')}>
          {logout.isPending ? 'Logging out…' : 'Log out'}
        </span>
      </button>
    </div>
  );
}
