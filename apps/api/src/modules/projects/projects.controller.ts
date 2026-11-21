// HTTP layer for projects.
import { createProjectSchema, type Project } from '@debrief/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { getAuthUser } from '../../middleware/requireAuth';
import { projectsService } from './projects.service';

function projectId(req: Request) {
  const result = z.uuid().safeParse(req.params.id);
  if (!result.success) throw notFound('Project');
  return result.data;
}

export const projectsController = {
  async list(req: Request, res: Response) {
    res.json({ projects: await projectsService.list(getAuthUser(req).id) });
  },
  async create(req: Request, res: Response) {
    const { name } = createProjectSchema.parse(req.body);
    const project = await projectsService.create(getAuthUser(req).id, name);
    res.status(201).json({ project } satisfies { project: Project });
  },
  async update(req: Request, res: Response) {
    const { name } = createProjectSchema.parse(req.body);
    const project = await projectsService.update(getAuthUser(req).id, projectId(req), name);
    res.json({ project } satisfies { project: Project });
  },
  async remove(req: Request, res: Response) {
    await projectsService.remove(getAuthUser(req).id, projectId(req));
    res.status(204).end();
  },
};
