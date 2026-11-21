// The signed-in layout: sidebar, top bar and the page panel.
import {
  Archive,
  ChevronDown,
  Folder,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import type { MeetingListItem } from '@debrief/shared';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Collapsible } from '@/components/ui/Collapsible';
import { Logo } from '@/components/ui/Logo';
import { useActionItems } from '@/features/actionItems/hooks';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { useMeetings, usePrefetchMeeting } from '@/features/meetings/hooks';
import { MeetingMenu } from '@/features/meetings/MeetingMenu';
import { SearchDialog } from '@/features/meetings/SearchDialog';
import { cn } from '@/lib/cn';
import { AUTH_PANEL_LEFT, type EntranceState } from './authExit';
import { PageBarSlot, PanelOverlaySlot } from './PageBar';
import { PanelBackdrop } from './PanelBackdrop';
import { ShellFrameContext, type ShellFrameClasses } from './shellFrame';
import { SkipLink } from './SkipLink';

const COLLAPSED_KEY = 'debrief.sidebarCollapsed';

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? '0' : '1');
      } catch {
        // Storage blocked: the toggle still works, it just isn't remembered.
      }
      return !current;
    });
  return { collapsed, toggle };
}

function useEntrance() {
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = new URLSearchParams(location.search).get('signed_in');
  const [entering, setEntering] = useState(
    () => Boolean((location.state as EntranceState | null)?.entrance) || signedIn !== null,
  );

  useEffect(() => {
    if (signedIn === null) return;
    const params = new URLSearchParams(location.search);
    params.delete('signed_in');
    const search = params.size ? `?${params}` : '';
    navigate(`${location.pathname}${search}${location.hash}`, {
      replace: true,
      state: { entrance: true, welcome: signedIn === 'new' } satisfies EntranceState,
    });
  }, [signedIn, location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => setEntering(false), 1400);
    return () => clearTimeout(timer);
  }, [entering]);

  return entering;
}

export function AppShell() {
  const { mainRef, scrollRef } = useMainFocusOnNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(setSearchOpen);
  const { collapsed, toggle } = useSidebarCollapsed();
  const entering = useEntrance();
  const [pageBarSlot, setPageBarSlot] = useState<HTMLDivElement | null>(null);
  const [panelOverlay, setPanelOverlay] = useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<ShellFrameClasses | null>(null);
  const panelInset = frame?.panel ?? null;
  const { pathname } = useLocation();
  // Moving between meetings keeps the page mounted, so the bar and Ask card stay in place.
  const pageKey = /^\/meetings\/[^/]+$/.test(pathname) ? 'meeting' : pathname;

  return (
    <div className="min-h-dvh bg-bg lg:flex lg:h-dvh lg:bg-sidebar">
      <SkipLink />
      <aside
        id="workspace-sidebar"
        aria-label="Workspace sidebar"
        className={cn(
          'hidden shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-fg transition-[width] duration-300 ease-out-3 lg:flex',
          collapsed ? 'w-rail' : 'w-sidebar',
          entering && 'lg:animate-sidebar-in',
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapsed={toggle}
          onOpenSearch={() => setSearchOpen(true)}
        />
      </aside>
      <MobileSidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenSearch={() => {
          setMenuOpen(false);
          setSearchOpen(true);
        }}
      />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

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
          aria-label="New meeting"
        >
          New
        </Button>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className={cn(
          'min-w-0 outline-none lg:my-5 lg:mr-5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col',
          entering && 'lg:animate-panel-expand',
        )}
        style={
          {
            '--panel-from': `max(0px, calc(${AUTH_PANEL_LEFT} - var(${collapsed ? '--spacing-rail' : '--spacing-sidebar'})))`,
          } as CSSProperties
        }
      >
        <div ref={setPageBarSlot} className="relative z-30" />
        <div
          className={cn(
            'relative lg:min-h-0 lg:flex-1',
            !panelInset && 'lg:overflow-hidden lg:rounded-panel',
          )}
        >
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 hidden overflow-hidden rounded-panel bg-bg transition-[right] duration-500 ease-panel lg:block',
              panelInset,
            )}
          >
            <PanelBackdrop contained />
          </div>
          <div className="lg:hidden">
            <PanelBackdrop />
          </div>
          <div
            ref={scrollRef}
            data-scroller=""
            className={cn(
              'relative lg:scrollbar-panel lg:h-full lg:overflow-y-auto',
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
                    <div
                      key={pageKey}
                      className={entering ? 'animate-page-enter' : 'animate-page-in'}
                    >
                      <Outlet />
                    </div>
                  </PanelOverlaySlot.Provider>
                </PageBarSlot.Provider>
              </ShellFrameContext.Provider>
            </div>
          </div>
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

// Ctrl+K (or Cmd+K on a Mac) opens search from anywhere.
function useSearchShortcut(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);
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
    if (!hash) scrollRef.current?.scrollTo?.({ top: 0 });
  }, [pathname, hash]);
  return { mainRef, scrollRef };
}

function MobileSidebar({
  open,
  onClose,
  onOpenSearch,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
}) {
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
      className="m-0 h-dvh max-h-dvh w-[min(88vw,21rem)] max-w-none bg-sidebar p-0 text-sidebar-fg shadow-raised backdrop:bg-sidebar/50 backdrop:backdrop-blur-sm open:motion-safe:animate-drawer-in open:backdrop:motion-safe:animate-fade-in lg:hidden"
    >
      <SidebarContent onNavigate={onClose} onClose={onClose} onOpenSearch={onOpenSearch} />
    </dialog>
  );
}

function SidebarContent({
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapsed,
  onOpenSearch,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onOpenSearch: () => void;
}) {
  const { data: meetings, isPending, error, refetch } = useMeetings();
  const pinned = meetings?.filter((meeting) => meeting.pinnedAt) ?? [];
  const recent = meetings?.filter((meeting) => !meeting.pinnedAt) ?? [];
  const openActions =
    useActionItems({ status: 'open', overdue: false }).data?.actionItems.length ?? 0;
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
        <button
          type="button"
          onClick={onOpenSearch}
          title={collapsed ? 'Search (Ctrl+K)' : undefined}
          aria-keyshortcuts="Control+K"
          className={cn(navClass(false, collapsed), 'w-full')}
        >
          <Search aria-hidden="true" className="size-5 shrink-0" />
          {label('Search')}
          {!collapsed && (
            <kbd
              aria-hidden="true"
              className="ml-auto rounded-sm border border-sidebar-line px-1.5 font-sans text-xs text-sidebar-muted"
            >
              Ctrl K
            </kbd>
          )}
        </button>
        {(
          [
            ['/items', ListChecks, 'Actions'],
            ['/projects', Folder, 'Projects'],
          ] as const
        ).map(([to, Icon, text]) => {
          const count = to === '/items' ? openActions : 0;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              title={collapsed ? text : undefined}
              aria-label={count > 0 ? `${text}, ${count} open` : undefined}
              className={({ isActive }) => navClass(isActive, collapsed)}
            >
              <span className="relative shrink-0">
                <Icon aria-hidden="true" className="size-5" />
                {collapsed && count > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 size-2.5 rounded-pill bg-spark ring-2 ring-sidebar"
                  />
                )}
              </span>
              {label(text)}
              {count > 0 && (
                <span
                  className={cn(
                    'ml-auto min-w-6 rounded-pill bg-spark px-1.5 text-center text-xs leading-5 font-bold text-fg tabular-nums',
                    collapsed && 'sr-only',
                  )}
                >
                  {count}
                </span>
              )}
            </NavLink>
          );
        })}
        <ArchivedDropdown
          collapsed={collapsed}
          onExpandSidebar={onToggleCollapsed}
          onNavigate={onNavigate}
        />
      </nav>

      {collapsed ? (
        <div className="flex-1" />
      ) : (
        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <Divider />
          {pinned.length > 0 && (
            <section aria-label="Pinned meetings" className="flex max-h-[35%] shrink-0 flex-col">
              <SectionHeading
                icon={<Pin aria-hidden="true" className="size-3.5" />}
                count={pinned.length}
              >
                Pinned
              </SectionHeading>
              <div className="scrollbar-panel mt-1 min-h-0 overflow-y-auto scroll-fade px-2 pt-3 pb-3">
                <MeetingLinks meetings={pinned} onNavigate={onNavigate} />
              </div>
            </section>
          )}
          {pinned.length > 0 && <Divider />}
          <section aria-label="Recent meetings" className="flex min-h-0 flex-1 flex-col">
            <SectionHeading count={meetings ? recent.length : undefined}>
              Recent meetings
            </SectionHeading>
            <div className="scrollbar-panel mt-1 min-h-0 flex-1 overflow-y-auto scroll-fade px-2 pt-3 pb-4">
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
              ) : recent.length > 0 ? (
                <MeetingLinks meetings={recent} onNavigate={onNavigate} />
              ) : (
                <p className="px-3 py-2 text-sm text-sidebar-muted">
                  {pinned.length > 0
                    ? 'Every meeting is pinned.'
                    : 'Your meetings will appear here.'}
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      <AccountBlock onNavigate={onNavigate} collapsed={collapsed} />
    </div>
  );
}

// A short line between sidebar sections, inset from both edges.
function Divider() {
  return <div aria-hidden="true" className="mx-5 h-px shrink-0 rounded-pill bg-sidebar-line" />;
}

// Archived meetings open in place: the list slides down and pushes the sections below it.
function ArchivedDropdown({
  collapsed,
  onExpandSidebar,
  onNavigate,
}: {
  collapsed: boolean;
  onExpandSidebar?: () => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { data: archived, isPending, error } = useMeetings({ archived: true });
  const toggle = () => {
    if (collapsed) {
      onExpandSidebar?.();
      setOpen(true);
    } else setOpen((current) => !current);
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed && open}
        aria-controls={listId}
        title={collapsed ? 'Archived' : undefined}
        className={cn(navClass(false, collapsed), 'w-full')}
      >
        <Archive aria-hidden="true" className="size-5 shrink-0" />
        <span className={cn(collapsed && 'sr-only')}>Archived</span>
        {!collapsed && (
          <span className="ml-auto flex items-center gap-2 text-xs text-sidebar-muted tabular-nums">
            {archived && archived.length > 0 && archived.length}
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 transition-transform duration-300', open && 'rotate-180')}
            />
          </span>
        )}
      </button>
      {!collapsed && (
        <Collapsible id={listId} open={open}>
          <div className="scrollbar-panel max-h-56 overflow-y-auto py-1 pl-3">
            {isPending ? (
              <p className="px-3 py-2 text-sm text-sidebar-muted">Loading…</p>
            ) : error ? (
              <p className="px-3 py-2 text-sm text-sidebar-muted">
                Couldn&apos;t load archived meetings.
              </p>
            ) : archived.length === 0 ? (
              <p className="px-3 py-2 text-sm text-sidebar-muted">Nothing archived yet.</p>
            ) : (
              <div className="border-l border-sidebar-line pl-1">
                <MeetingLinks meetings={archived} onNavigate={onNavigate} />
              </div>
            )}
          </div>
        </Collapsible>
      )}
    </div>
  );
}

function SectionHeading({
  icon,
  count,
  children,
}: {
  icon?: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between px-5 pt-4">
      <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-label whitespace-nowrap text-sidebar-muted uppercase">
        {icon}
        {children}
      </h2>
      {count !== undefined && (
        <span className="text-xs text-sidebar-muted tabular-nums">{count}</span>
      )}
    </div>
  );
}

// Hovering or focusing a meeting starts loading it, so opening it feels instant.
function MeetingLinks({
  meetings,
  onNavigate,
}: {
  meetings: MeetingListItem[];
  onNavigate?: () => void;
}) {
  const prefetch = usePrefetchMeeting();
  return (
    <ul className="space-y-0.5">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="flex items-center rounded-md hover:bg-sidebar-hover">
          <NavLink
            to={`/meetings/${meeting.id}`}
            onClick={onNavigate}
            onPointerEnter={() => prefetch(meeting.id)}
            onFocus={() => prefetch(meeting.id)}
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
    <div className={cn('shrink-0 p-3 pt-0', collapsed && 'px-2')}>
      <div aria-hidden="true" className="mx-2 mb-3 h-px rounded-pill bg-sidebar-line" />
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
