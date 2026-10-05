/**
 * Route untuk mata kuliah, semester, dan tag.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  createCourseSchema,
  createSemesterSchema,
  updateCourseSchema,
} from '../../../shared/schemas';
import { createCourseController, createTagController } from '../controllers/courseController';
import { validate } from '../middleware/validate';
import type { CourseService } from '../services/courseService';
import type { TagService } from '../services/tagService';

const idParamSchema = z.object({ id: z.string().min(1, 'ID wajib diisi') });

export function createCourseRoutes(service: CourseService): Router {
  const router = Router();
  const controller = createCourseController(service);

  router.get('/', controller.list);
  router.post('/', validate(createCourseSchema, 'body'), controller.create);
  router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
  router.patch('/:id', validate(idParamSchema, 'params'), validate(updateCourseSchema, 'body'), controller.update);
  router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

  return router;
}

export function createSemesterRoutes(service: CourseService): Router {
  const router = Router();
  const controller = createCourseController(service);

  router.get('/', controller.listSemesters);
  router.post('/', validate(createSemesterSchema, 'body'), controller.createSemester);

  return router;
}

export function createTagRoutes(service: TagService): Router {
  const router = Router();
  const controller = createTagController(service);

  router.get('/', controller.list);

  return router;
}
