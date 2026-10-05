/**
 * Controller course, semester, dan tag: memetakan HTTP ke service.
 */
import type { Request, Response } from 'express';
import type { CreateCourseInput, CreateSemesterInput, UpdateCourseInput } from '../../../shared/schemas.js';
import { getValidated } from '../middleware/validate.js';
import type { CourseService } from '../services/courseService.js';
import type { TagService } from '../services/tagService.js';
import { ValidationError } from '../utils/errors.js';

function requireId(req: Request, field = 'id'): string {
  const id = req.params[field];
  if (typeof id !== 'string' || id === '') {
    throw new ValidationError('Parameter tidak valid.', [
      { field, message: 'Wajib diisi' },
    ]);
  }
  return id;
}

export function createCourseController(service: CourseService) {
  return {
    list: async (_req: Request, res: Response): Promise<void> => {
      res.status(200).json({ data: await service.listCourses() });
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      res.status(200).json({ data: await service.getCourse(requireId(req)) });
    },

    create: async (req: Request, res: Response): Promise<void> => {
      const input = getValidated<CreateCourseInput>(req, 'body');
      res.status(201).json({ data: await service.createCourse(input) });
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const input = getValidated<UpdateCourseInput>(req, 'body');
      res.status(200).json({ data: await service.updateCourse(requireId(req), input) });
    },

    remove: async (req: Request, res: Response): Promise<void> => {
      await service.deleteCourse(requireId(req));
      res.status(204).send();
    },

    listSemesters: async (_req: Request, res: Response): Promise<void> => {
      res.status(200).json({ data: await service.listSemesters() });
    },

    createSemester: async (req: Request, res: Response): Promise<void> => {
      const input = getValidated<CreateSemesterInput>(req, 'body');
      res.status(201).json({ data: await service.createSemester(input) });
    },
  };
}

export function createTagController(service: TagService) {
  return {
    list: async (_req: Request, res: Response): Promise<void> => {
      res.status(200).json({ data: await service.list() });
    },
  };
}
