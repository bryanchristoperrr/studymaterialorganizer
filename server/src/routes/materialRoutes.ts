/**
 * Definisi route HTTP. Route hanya memasang middleware + controller; validasi
 * bentuk request terjadi di middleware `validate`.
 */
import { Router } from 'express';
import { z } from 'zod';
import { createMaterialSchema, materialsQuerySchema, updateMaterialSchema } from '../../../shared/schemas';
import { createMaterialController } from '../controllers/materialController';
import { validate } from '../middleware/validate';
import type { MaterialService } from '../services/materialService';

/** :id harus berupa string non-kosong (UUID berawalan 'm_' dari service). */
const idParamSchema = z.object({ id: z.string().min(1, 'ID wajib diisi') });

/** Body untuk endpoint cek duplikat. */
const duplicateCheckSchema = z
  .object({
    doi: z.string().trim().max(255).optional(),
    url: z.string().trim().max(2048).optional(),
  })
  .refine((data) => Boolean(data.doi || data.url), {
    message: 'Isi DOI atau URL untuk mengecek duplikat',
  });

export function createMaterialRoutes(service: MaterialService): Router {
  const router = Router();
  const controller = createMaterialController(service);

  // PENTING: /duplicate-check didaftarkan sebelum /:id agar tidak tertangkap
  // sebagai param id.
  router.post('/duplicate-check', validate(duplicateCheckSchema, 'body'), controller.checkDuplicates);

  router.get('/', validate(materialsQuerySchema, 'query'), controller.list);
  router.post('/', validate(createMaterialSchema, 'body'), controller.create);
  router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
  router.patch('/:id', validate(idParamSchema, 'params'), validate(updateMaterialSchema, 'body'), controller.update);
  router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);
  router.post('/:id/restore', validate(idParamSchema, 'params'), controller.restore);
  router.delete('/:id/purge', validate(idParamSchema, 'params'), controller.purge);

  return router;
}
