// The little menu next to a meeting in the sidebar. It floats above the page (so it never stretches
// the sidebar list) and opens upwards when there isn't room below.
import type { MeetingListItem } from '@debrief/shared';
import {
  Archive,
  ArchiveRestore,
  Folder,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/lib/cn';
import { fixedFrame } from '@/lib/floating';
import { DeleteMeetingDialog } from './DeleteMeetingDialog';
import { EditMeetingDialog } from './EditMeetingDialog';
import { useProjects, useUpdateMeeting } from './hooks';

const MENU_HEIGHT = 280;

type Position = { right: number; top?: number; bottom?: number };
type MenuState = { style: Position; container: Element };

export function MeetingMenu({ meeting }: { meeting: MeetingListItem }) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const update = useUpdateMeeting(meeting.id);
  const { data: projects = [] } = useProjects();
  const navigate = useNavigate();
  const close = () => {
    setMenu(null);
    setShowProjects(false);
  };
  const toggle = () => {
    const box = button.current?.getBoundingClientRect();
    if (menu || !button.current || !box) return close();
    // Inside the mobile drawer (a modal dialog) the menu must live in the dialog to show.
    const container = button.current.closest('dialog') ?? document.body;
    const frame = fixedFrame(container);
    const right = frame.right - box.right;
    const roomBelow = window.innerHeight - box.bottom;
    setMenu({
      style:
        roomBelow < MENU_HEIGHT
          ? { right, bottom: frame.bottom - box.top + 4 }
          : { right, top: box.bottom - frame.top + 4 },
      container,
    });
  };

  // Close on a click elsewhere, Escape, scrolling the list behind it, or resizing.
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      button.current?.focus();
    };
    const onScroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);
  const change = (patch: { pinned?: boolean; archived?: boolean; projectId?: string | null }) => {
    update.mutate(patch, { onSuccess: close });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`More options for ${meeting.title}`}
        aria-expanded={menu !== null}
        onClick={toggle}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      {menu &&
        createPortal(
          <div
            ref={panel}
            style={menu.style}
            className={cn(
              'fixed z-50 w-52 rounded-card border border-white/70 glass-float p-1.5 text-fg shadow-raised motion-safe:animate-search-in',
              menu.style.bottom !== undefined ? 'origin-bottom-right' : 'origin-top-right',
            )}
            role="group"
            aria-label={`Options for ${meeting.title}`}
          >
            {update.error && (
              <Alert tone="danger" className="mb-1 text-sm">
                {update.error.message}
              </Alert>
            )}
            <MenuAction
              icon={<Pencil />}
              onClick={() => {
                close();
                setDialog('edit');
              }}
            >
              Rename
            </MenuAction>
            <MenuAction
              icon={meeting.pinnedAt ? <PinOff /> : <Pin />}
              onClick={() => change({ pinned: !meeting.pinnedAt })}
            >
              {meeting.pinnedAt ? 'Unpin' : 'Pin'}
            </MenuAction>
            <MenuAction icon={<Folder />} onClick={() => setShowProjects((value) => !value)}>
              Add to project
            </MenuAction>
            {showProjects && (
              <div className="ml-3 border-l border-line pl-2">
                <MenuAction onClick={() => change({ projectId: null })}>No project</MenuAction>
                {projects.map((project) => (
                  <MenuAction key={project.id} onClick={() => change({ projectId: project.id })}>
                    {project.name}
                    {meeting.projectId === project.id ? ' ✓' : ''}
                  </MenuAction>
                ))}
                {projects.length === 0 && (
                  <p className="px-2 py-1 text-sm text-muted">Create a project first</p>
                )}
              </div>
            )}
            <MenuAction
              icon={meeting.archivedAt ? <ArchiveRestore /> : <Archive />}
              onClick={() => change({ archived: !meeting.archivedAt })}
            >
              {meeting.archivedAt ? 'Restore' : 'Archive'}
            </MenuAction>
            <div aria-hidden="true" className="mx-2 my-1 h-px bg-line" />
            <MenuAction
              danger
              icon={<Trash2 />}
              onClick={() => {
                close();
                setDialog('delete');
              }}
            >
              Delete
            </MenuAction>
          </div>,
          menu.container,
        )}
      <EditMeetingDialog
        meeting={meeting}
        open={dialog === 'edit'}
        onClose={() => setDialog(null)}
      />
      <DeleteMeetingDialog
        meeting={meeting}
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onDeleted={() => {
          setDialog(null);
          navigate('/meetings', { state: { deleted: meeting.title } });
        }}
      />
    </>
  );
}

function MenuAction({
  icon,
  children,
  onClick,
  danger = false,
}: {
  icon?: React.ReactElement;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm transition-colors',
        danger ? 'text-danger hover:bg-danger-soft' : 'hover:bg-accent-soft hover:text-accent',
      )}
    >
      {icon && (
        <span className="[&>svg]:size-4" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
