/**
 * Route untuk mata kuliah, semester, dan tag.
 *
 * Controller async dibungkus `asyncHandler` agar rejection
 * diteruskan ke errorHandler global.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  createCourseSchema,
  createSemesterSchema,
  updateCourseSchema,
} from '../../shared/schemas.js';
import { createCourseController, createTagController } from '../controllers/courseController.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { CourseService } from '../services/courseService.js';
import type { TagService } from '../services/tagService.js';

const idParamSchema = z.object({ id: z.string().min(1, 'ID wajib diisi') });

export function createCourseRoutes(service: CourseService): Router {
  const router = Router();
  const controller = createCourseController(service);

  router.get('/', asyncHandler(controller.list));
  router.post('/', validate(createCourseSchema, 'body'), asyncHandler(controller.create));
  router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.getById));
  router.patch('/:id', validate(idParamSchema, 'params'), validate(updateCourseSchema, 'body'), asyncHandler(controller.update));
  router.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.remove));

  return router;
}

export function createSemesterRoutes(service: CourseService): Router {
  const router = Router();
  const controller = createCourseController(service);

  router.get('/', asyncHandler(controller.listSemesters));
  router.post('/', validate(createSemesterSchema, 'body'), asyncHandler(controller.createSemester));

  return router;
}

export function createTagRoutes(service: TagService): Router {
  const router = Router();
  const controller = createTagController(service);

  router.get('/', asyncHandler(controller.list));

  return router;
}
