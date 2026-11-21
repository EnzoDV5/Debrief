// The little menu next to a meeting in the sidebar.
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
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { DeleteMeetingDialog } from './DeleteMeetingDialog';
import { EditMeetingDialog } from './EditMeetingDialog';
import { useProjects, useUpdateMeeting } from './hooks';

export function MeetingMenu({ meeting }: { meeting: MeetingListItem }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const update = useUpdateMeeting(meeting.id);
  const { data: projects = [] } = useProjects();
  const navigate = useNavigate();
  const close = () => {
    if (details.current) details.current.open = false;
    setShowProjects(false);
  };
  const change = (patch: { pinned?: boolean; archived?: boolean; projectId?: string | null }) => {
    update.mutate(patch, { onSuccess: close });
  };

  return (
    <>
      <details
        ref={details}
        className="relative shrink-0"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) close();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            close();
            details.current?.querySelector('summary')?.focus();
          }
        }}
      >
        <summary
          aria-label={`More options for ${meeting.title}`}
          className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white [&::-webkit-details-marker]:hidden"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </summary>
        <div
          className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-line bg-surface p-1 text-fg shadow-raised"
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
          <MenuAction
            icon={<Trash2 />}
            onClick={() => {
              close();
              setDialog('delete');
            }}
          >
            Delete
          </MenuAction>
        </div>
      </details>
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
}: {
  icon?: React.ReactElement;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-sm hover:bg-surface-2"
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
