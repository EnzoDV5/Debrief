// The buttons in the meeting bar: move to a project, archive and delete.
import { ARCHIVE_WHILE_ANALYSING_MESSAGE, isAnalysing, type Meeting } from '@debrief/shared';
import { Archive, ArchiveRestore, Check, ChevronDown, Folder, Trash2 } from 'lucide-react';
import { useRef, useState, type ComponentProps } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/lib/cn';
import { DeleteMeetingDialog } from '../DeleteMeetingDialog';
import { useProjects, useUpdateMeeting } from '../hooks';

type Tone = 'default' | 'highlight' | 'danger';

// Same hover as the app's buttons: a colour wipes up from the bottom and the text flips. On the
// dark bar (wide screens) the wipe is white with dark text; on the light page it's dark with white.
const tones: Record<Tone, string> = {
  default:
    'border-line-strong bg-[linear-gradient(to_top,var(--color-fg)_50%,var(--color-surface)_50%)] text-fg shadow-card hover:border-fg hover:text-surface hover:shadow-none ' +
    'lg:border-sidebar-line lg:bg-[linear-gradient(to_top,var(--color-sidebar-strong)_50%,var(--color-sidebar-hover)_50%)] lg:text-sidebar-fg lg:shadow-none lg:hover:border-sidebar-strong lg:hover:text-sidebar ' +
    // A disabled button keeps its resting colours on hover (the wipe doesn't run, so the text would vanish).
    'disabled:hover:border-line-strong disabled:hover:text-fg lg:disabled:hover:border-sidebar-line lg:disabled:hover:text-sidebar-fg',
  highlight:
    'border-spark bg-[linear-gradient(to_top,var(--color-sidebar-strong)_50%,var(--color-spark)_50%)] text-spark-fg shadow-card hover:border-sidebar-strong hover:text-sidebar hover:shadow-none lg:shadow-none',
  danger:
    'border-danger/40 bg-[linear-gradient(to_top,var(--color-danger)_50%,var(--color-surface)_50%)] text-danger shadow-card hover:border-danger hover:text-danger-fg hover:shadow-none ' +
    'lg:border-danger-light/40 lg:bg-[linear-gradient(to_top,var(--color-danger-light)_50%,transparent_50%)] lg:text-danger-light lg:shadow-none lg:hover:border-danger-light lg:hover:text-sidebar',
};

export function barButtonClass(tone: Tone = 'default', expanded = false) {
  return cn(
    'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-clip-padding px-3 text-sm font-semibold ' +
      '[background-size:100%_210%] bg-top hover:bg-bottom ' +
      'transition-[background-position,color,border-color,box-shadow,scale] duration-300 ease-out-3 active:scale-[0.97] lg:focus-visible:outline-sidebar-strong ' +
      'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-top disabled:active:scale-100',
    tones[tone],
    expanded &&
      'bg-accent-soft bg-none text-accent lg:border-sidebar-strong lg:bg-sidebar-strong lg:text-sidebar',
  );
}

export function BarButton({
  tone = 'default',
  className,
  ...props
}: ComponentProps<'button'> & { tone?: Tone }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(barButtonClass(tone, props['aria-expanded'] === true), className)}
    />
  );
}

export function ProjectMenu({ meeting }: { meeting: Meeting }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const update = useUpdateMeeting(meeting.id);
  const { data: projects = [] } = useProjects();
  const current = projects.find((project) => project.id === meeting.projectId);
  const close = () => {
    if (details.current) details.current.open = false;
  };
  const choose = (projectId: string | null) => update.mutate({ projectId }, { onSuccess: close });

  return (
    <details
      ref={details}
      className="relative"
      onToggle={(event) => setOpen(event.currentTarget.open)}
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
        className={cn(
          barButtonClass('default', open),
          'list-none [&::-webkit-details-marker]:hidden',
        )}
      >
        <Folder aria-hidden="true" className="size-4" />
        <span className="max-w-40 truncate">{current ? current.name : 'Add to project'}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </summary>
      <div
        role="group"
        aria-label="Choose a project"
        className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-card border border-glass-edge glass-float p-1.5 text-fg shadow-raised motion-safe:animate-search-in"
      >
        {update.error && (
          <Alert tone="danger" className="mb-1 text-sm">
            {update.error.message}
          </Alert>
        )}
        {projects.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted">
            No projects yet.{' '}
            <Link to="/projects" className="font-semibold text-accent hover:underline">
              Create one
            </Link>
          </p>
        ) : (
          <>
            {projects.map((project) => (
              <ProjectOption
                key={project.id}
                selected={project.id === meeting.projectId}
                onClick={() => choose(project.id)}
              >
                {project.name}
              </ProjectOption>
            ))}
            {meeting.projectId && (
              <ProjectOption selected={false} onClick={() => choose(null)}>
                Remove from project
              </ProjectOption>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function ProjectOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm transition-colors hover:bg-accent-soft hover:text-accent',
        selected && 'font-semibold',
      )}
    >
      <Folder aria-hidden="true" className="size-4 shrink-0 opacity-70" />
      <span className="flex-1 truncate">{children}</span>
      {selected && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />}
    </button>
  );
}

export function ArchiveButton({ meeting }: { meeting: Meeting }) {
  const update = useUpdateMeeting(meeting.id);
  const archived = meeting.archivedAt !== null;
  // Archiving mid-analysis would hide the meeting while the result is still coming in.
  const blocked = !archived && isAnalysing(meeting.analysisStatus);
  return (
    <BarButton
      disabled={update.isPending || blocked}
      onClick={() => update.mutate({ archived: !archived })}
      title={blocked ? ARCHIVE_WHILE_ANALYSING_MESSAGE : update.error?.message}
    >
      {archived ? (
        <ArchiveRestore aria-hidden="true" className="size-4" />
      ) : (
        <Archive aria-hidden="true" className="size-4" />
      )}
      {archived ? 'Restore' : 'Archive'}
    </BarButton>
  );
}

export function DeleteButton({ meeting }: { meeting: Meeting }) {
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <BarButton
        tone="danger"
        aria-label="Delete meeting"
        title="Delete meeting"
        onClick={() => setConfirming(true)}
        className="w-9 justify-center px-0"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </BarButton>
      <DeleteMeetingDialog
        meeting={meeting}
        open={confirming}
        onClose={() => setConfirming(false)}
        onDeleted={() =>
          navigate('/meetings', { replace: true, state: { deleted: meeting.title } })
        }
      />
    </>
  );
}
