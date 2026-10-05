/**
 * Controller course, semester, dan tag: memetakan HTTP ke service.
 */
import type { Request, Response } from 'express';
import type { CreateCourseInput, CreateSemesterInput, UpdateCourseInput } from '../../../shared/schemas';
import { getValidated } from '../middleware/validate';
import type { CourseService } from '../services/courseService';
import type { TagService } from '../services/tagService';
import { ValidationError } from '../utils/errors';

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
    list: (_req: Request, res: Response): void => {
      res.status(200).json({ data: service.listCourses() });
    },

    getById: (req: Request, res: Response): void => {
      res.status(200).json({ data: service.getCourse(requireId(req)) });
    },

    create: (req: Request, res: Response): void => {
      const input = getValidated<CreateCourseInput>(req, 'body');
      res.status(201).json({ data: service.createCourse(input) });
    },

    update: (req: Request, res: Response): void => {
      const input = getValidated<UpdateCourseInput>(req, 'body');
      res.status(200).json({ data: service.updateCourse(requireId(req), input) });
    },

    remove: (req: Request, res: Response): void => {
      service.deleteCourse(requireId(req));
      res.status(204).send();
    },

    listSemesters: (_req: Request, res: Response): void => {
      res.status(200).json({ data: service.listSemesters() });
    },

    createSemester: (req: Request, res: Response): void => {
      const input = getValidated<CreateSemesterInput>(req, 'body');
      res.status(201).json({ data: service.createSemester(input) });
    },
  };
}

export function createTagController(service: TagService) {
  return {
    list: (_req: Request, res: Response): void => {
      res.status(200).json({ data: service.list() });
    },
  };
}
