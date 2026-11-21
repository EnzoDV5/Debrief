// Projects as expandable rows, with their meetings and controls kept together.
import type { ProjectWithCount } from '@debrief/shared';
import { CalendarDays, ChevronDown, Folder, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Collapsible } from '@/components/ui/Collapsible';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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

export function ProjectsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: projects, isPending, error, refetch } = useProjects();
  const selected = projects?.find((project) => project.id === projectId);
  const {
    data: meetings,
    isPending: meetingsPending,
    error: meetingError,
    refetch: refetchMeetings,
  } = useMeetings(projectId ? { projectId } : {}, Boolean(projectId));
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const toggleProject = (project: ProjectWithCount) => {
    setEditing(null);
    navigate(projectId === project.id ? '/projects' : `/projects/${project.id}`);
  };
  const deleteProject = (project: ProjectWithCount) => {
    if (
      !window.confirm(
        `Delete project “${project.name}”? Its meetings will stay in Recent meetings.`,
      )
    )
      return;
    remove.mutate(project.id, {
      onSuccess: () => {
        if (projectId === project.id) navigate('/projects');
      },
    });
  };

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
          message={error.message}
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
            <div className="space-y-4">
              {projects.map((project) => {
                const open = project.id === projectId;
                const isEditing = editing?.id === project.id;
                const contentId = `project-${project.id}-meetings`;
                return (
                  <section
                    key={project.id}
                    aria-label={project.name}
                    className={cn(
                      'overflow-hidden rounded-card border border-white/70 glass shadow-card transition-colors',
                      open && 'border-accent/40',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-4 p-5 sm:gap-5 sm:p-6">
                      <button
                        type="button"
                        aria-label={`${open ? 'Collapse' : 'Expand'} ${project.name} meetings`}
                        aria-expanded={open}
                        aria-controls={contentId}
                        onClick={() => toggleProject(project)}
                        className="group flex min-w-0 flex-1 items-center gap-4 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                      >
                        <span className="grid size-14 shrink-0 place-items-center rounded-card bg-accent-soft text-accent sm:size-16">
                          <Folder aria-hidden="true" className="size-7 sm:size-8" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xl font-bold sm:text-2xl">
                            {project.name}
                          </span>
                          <span className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
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
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Pencil aria-hidden="true" className="size-4" />}
                          onClick={() => setEditing({ id: project.id, name: project.name })}
                        >
                          Edit name
                        </Button>
                        <Button
                          size="sm"
                          variant="dangerOutline"
                          icon={<Trash2 aria-hidden="true" className="size-4" />}
                          loading={remove.isPending && remove.variables === project.id}
                          disabled={remove.isPending}
                          onClick={() => deleteProject(project)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {isEditing && (
                      <form
                        className="flex flex-wrap items-center gap-2 px-5 pb-5 sm:px-6"
                        onSubmit={(event) => {
                          event.preventDefault();
                          update.mutate(editing, { onSuccess: () => setEditing(null) });
                        }}
                      >
                        <Input
                          aria-label={`New name for ${project.name}`}
                          value={editing.name}
                          onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                          className="w-auto min-w-64 flex-1"
                          maxLength={80}
                          required
                          autoFocus
                        />
                        <Button type="submit" size="sm" loading={update.isPending}>
                          Save
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        {update.error && update.variables?.id === project.id && (
                          <Alert tone="danger" className="w-full">
                            {update.error.message}
                          </Alert>
                        )}
                      </form>
                    )}
                    {remove.error && remove.variables === project.id && (
                      <Alert tone="danger" className="mx-5 mb-4 sm:mx-6">
                        {remove.error.message}
                      </Alert>
                    )}

                    <Collapsible id={contentId} open={open}>
                      {open && (
                        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                          {meetingError ? (
                            <ErrorState
                              title="Couldn't load project meetings"
                              message={meetingError.message}
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
              })}
              {projectId && !selected && <EmptyState icon={<Folder />} title="Project not found" />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
