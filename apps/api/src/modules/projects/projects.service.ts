// Rules for projects, like no two projects with the same name.
import type { Project } from '@debrief/shared';
import type { ProjectRow } from '../../db/schema';
import { AppError, notFound } from '../../lib/errors';
import { projectsRepository } from './projects.repository';

function toProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString() };
}

async function withNameConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const codeOf = (value: unknown) =>
      typeof value === 'object' && value !== null && 'code' in value ? value.code : undefined;
    const cause =
      typeof error === 'object' && error !== null && 'cause' in error ? error.cause : undefined;
    if (codeOf(error) === '23505' || codeOf(cause) === '23505') {
      throw new AppError(409, 'PROJECT_EXISTS', 'A project with this name already exists');
    }
    throw error;
  }
}

export const projectsService = {
  async list(userId: string) {
    return (await projectsRepository.list(userId)).map(toProject);
  },
  async create(userId: string, name: string) {
    return withNameConflict(async () => toProject(await projectsRepository.create(userId, name)));
  },
  async update(userId: string, id: string, name: string) {
    const row = await withNameConflict(() => projectsRepository.update(userId, id, name));
    if (!row) throw notFound('Project');
    return toProject(row);
  },
  async remove(userId: string, id: string) {
    if (!(await projectsRepository.remove(userId, id))) throw notFound('Project');
  },
};
