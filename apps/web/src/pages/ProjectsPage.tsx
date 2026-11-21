// Project rows expand in place to show their meetings and controls.
import type { ProjectWithCount } from '@debrief/shared';
import { CalendarDays, ChevronDown, Folder, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Collapsible } from '@/components/ui/Collapsible';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LOAD_ERROR_MESSAGE } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { MeetingResults } from '@/features/meetings/MeetingResults';
import {
  useCreateProject,
  useDeleteProject,
  useMeetings,
  useProjects,
  useUpdateProject,
} from '@/features/meetings/hooks';
import { cn } from '@/lib/cn';
import { formatDate, plural } from '@/lib/format';
import { useLingering } from '@/lib/useLingering';

export function ProjectsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: projects, isPending, error, refetch } = useProjects();
  const create = useCreateProject();
  const [newName, setNewName] = useState('');

  return (
    <div className={cn('mx-auto w-full', !projects?.length && 'lg:flex lg:min-h-full lg:flex-col')}>
      <PageHeader
        title="Projects"
        description="Group related meetings together."
        actions={
          <form
            className="flex w-full gap-2 lg:w-96"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate(newName.trim(), {
                onSuccess: (project) => {
                  setNewName('');
                  navigate(`/projects/${project.id}`);
                },
              });
            }}
          >
            <Input
              aria-label="Project name"
              placeholder="New project name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={80}
              required
            />
            <Button type="submit" icon={<Plus className="size-4" />} loading={create.isPending}>
              Create
            </Button>
          </form>
        }
      />

      {error ? (
        <ErrorState
          title="Couldn't load projects"
          message={LOAD_ERROR_MESSAGE}
          details={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          {create.error && (
            <Alert tone="danger" className="mb-4">
              {create.error.message}
            </Alert>
          )}
          {isPending ? (
            <p className="text-muted">Loading projects…</p>
          ) : !projects?.length ? (
            <EmptyState
              icon={<Folder />}
              title="No projects yet"
              description="Create one, then add meetings from their sidebar menus."
              variant="plain"
              size="large"
              className="lg:flex-1 lg:justify-center"
            />
          ) : (
            <div>
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  open={project.id === projectId}
                  onToggle={() =>
                    navigate(project.id === projectId ? '/projects' : `/projects/${project.id}`)
                  }
                  onDeleted={() => {
                    if (project.id === projectId) navigate('/projects');
                  }}
                />
              ))}
              {projectId && !projects.some((project) => project.id === projectId) && (
                <EmptyState icon={<Folder />} title="Project not found" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  open,
  onToggle,
  onDeleted,
}: {
  project: ProjectWithCount;
  open: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const [editName, setEditName] = useState<string | null>(null);
  const {
    data: meetings,
    isPending: meetingsPending,
    error: meetingError,
    refetch: refetchMeetings,
  } = useMeetings({ projectId: project.id }, open);
  // Keep the closing content mounted until the row has finished folding shut.
  const shown = useLingering(open ? project.id : null, 320) !== null;
  const contentId = `project-${project.id}-meetings`;

  const deleteProject = () => {
    if (
      !window.confirm(
        `Delete project “${project.name}”? Its meetings will stay in Recent meetings.`,
      )
    )
      return;
    remove.mutate(project.id, { onSuccess: onDeleted });
  };

  return (
    <section aria-label={project.name} className="border-b border-line/70">
      <div className="flex flex-wrap items-center gap-3 py-4 sm:py-5">
        <button
          type="button"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${project.name} meetings`}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Folder aria-hidden="true" className="size-6 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold sm:text-xl">{project.name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <ListChecks aria-hidden="true" className="size-4" />
                {plural(project.meetingCount, 'meeting')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-4" />
                Created {formatDate(project.createdAt)}
              </span>
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 text-muted transition-transform duration-300 group-hover:text-fg',
              open && 'rotate-180',
            )}
          />
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Edit name of ${project.name}`}
            title="Edit name"
            onClick={() => setEditName(project.name)}
            className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${project.name}`}
            title="Delete project"
            disabled={remove.isPending}
            onClick={deleteProject}
            className="grid size-9 place-items-center rounded-md text-danger transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-danger disabled:opacity-60"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {editName !== null && (
        <form
          className="flex flex-wrap items-center gap-2 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate(
              { id: project.id, name: editName },
              { onSuccess: () => setEditName(null) },
            );
          }}
        >
          <Input
            aria-label={`New name for ${project.name}`}
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            className="w-auto min-w-64 flex-1"
            maxLength={80}
            required
            autoFocus
          />
          <Button type="submit" size="sm" loading={update.isPending}>
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditName(null)}>
            Cancel
          </Button>
          {update.error && (
            <Alert tone="danger" className="w-full">
              {update.error.message}
            </Alert>
          )}
        </form>
      )}
      {remove.error && (
        <Alert tone="danger" className="mb-4">
          {remove.error.message}
        </Alert>
      )}

      <Collapsible id={contentId} open={open} flush>
        {shown && (
          <div className="border-t border-line/70 py-5">
            {meetingError ? (
              <ErrorState
                title="Couldn't load project meetings"
                message={LOAD_ERROR_MESSAGE}
                details={meetingError.message}
                onRetry={() => void refetchMeetings()}
              />
            ) : meetingsPending ? (
              <p role="status" className="py-8 text-center text-muted">
                Loading meetings…
              </p>
            ) : meetings?.length ? (
              <MeetingResults meetings={meetings} />
            ) : (
              <EmptyState
                icon={<Folder />}
                title="No meetings in this project"
                description="Use a meeting's menu to add it here."
                variant="plain"
                className="py-10"
              />
            )}
          </div>
        )}
      </Collapsible>
    </section>
  );
}
