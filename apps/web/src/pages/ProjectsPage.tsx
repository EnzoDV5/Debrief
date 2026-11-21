// Projects and the meetings in each one.
import { Folder, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
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

export function ProjectsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: projects, isPending, error, refetch } = useProjects();
  const selected = projects?.find((project) => project.id === projectId);
  const { data: meetings, error: meetingError } = useMeetings(projectId ? { projectId } : {});
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={selected?.name ?? 'Projects'}
        description="Group related meetings together."
      />
      {error ? (
        <ErrorState
          title="Couldn't load projects"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <form
            className="mb-6 flex max-w-lg gap-2"
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
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
              <nav aria-label="Projects" className="space-y-1">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className={`block rounded-md px-3 py-2 text-sm ${project.id === projectId ? 'bg-accent-soft font-semibold text-accent' : 'hover:bg-surface-2'}`}
                  >
                    <Folder aria-hidden="true" className="mr-2 inline size-4" />
                    {project.name}
                  </Link>
                ))}
              </nav>
              <div>
                {!projectId ? (
                  <EmptyState
                    icon={<Folder />}
                    title="Choose a project"
                    description="Its meetings will appear here."
                  />
                ) : !selected ? (
                  <EmptyState icon={<Folder />} title="Project not found" />
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {editName === null ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditName(selected.name)}
                        >
                          Rename project
                        </Button>
                      ) : (
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            update.mutate(
                              { id: selected.id, name: editName.trim() },
                              { onSuccess: () => setEditName(null) },
                            );
                          }}
                        >
                          <Input
                            aria-label="Rename project"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            maxLength={80}
                            required
                          />
                          <Button type="submit" size="sm" loading={update.isPending}>
                            Save
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditName(null)}>
                            Cancel
                          </Button>
                        </form>
                      )}
                      <Button
                        size="sm"
                        variant="dangerOutline"
                        icon={<Trash2 className="size-4" />}
                        loading={remove.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete project “${selected.name}”? Its meetings will stay in Recent meetings.`,
                            )
                          )
                            remove.mutate(selected.id, { onSuccess: () => navigate('/projects') });
                        }}
                      >
                        Delete project
                      </Button>
                    </div>
                    {(update.error || remove.error) && (
                      <Alert tone="danger" className="mb-4">
                        {(update.error || remove.error)?.message}
                      </Alert>
                    )}
                    {meetingError ? (
                      <ErrorState
                        title="Couldn't load project meetings"
                        message={meetingError.message}
                      />
                    ) : meetings?.length ? (
                      <MeetingResults meetings={meetings} />
                    ) : (
                      <EmptyState
                        icon={<Folder />}
                        title="No meetings in this project"
                        description="Use a meeting's menu to add it here."
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
