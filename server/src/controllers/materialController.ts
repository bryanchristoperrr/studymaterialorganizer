/**
 * Controller material: hanya berisi concern HTTP.
 * Validasi selesai di middleware `validate`, logika bisnis di service,
 * akses data di repository. Controller tidak pernah menyentuh database.
 */
import type { Request, Response } from 'express';
import type {
  CreateMaterialInput,
  MaterialsQuery,
  UpdateMaterialInput,
} from '../../../shared/schemas';
import { getValidated } from '../middleware/validate';
import type { MaterialService } from '../services/materialService';
import { ValidationError } from '../utils/errors';

/** Ambil :id dari path dan pastikan ada (middleware route sudah memvalidasi bentuknya). */
function requireId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id === '') {
    throw new ValidationError('ID material tidak valid.', [
      { field: 'id', message: 'Wajib diisi' },
    ]);
  }
  return id;
}

export function createMaterialController(service: MaterialService) {
  return {
    list: (req: Request, res: Response): void => {
      const query = getValidated<MaterialsQuery>(req, 'query');
      const { items, pagination } = service.list(query);
      res.status(200).json({ data: items, pagination });
    },

    getById: (req: Request, res: Response): void => {
      res.status(200).json({ data: service.getById(requireId(req)) });
    },

    create: (req: Request, res: Response): void => {
      const input = getValidated<CreateMaterialInput>(req, 'body');
      res.status(201).json({ data: service.create(input) });
    },

    update: (req: Request, res: Response): void => {
      const input = getValidated<UpdateMaterialInput>(req, 'body');
      res.status(200).json({ data: service.update(requireId(req), input) });
    },

    remove: (req: Request, res: Response): void => {
      service.softDelete(requireId(req));
      res.status(204).send();
    },

    restore: (req: Request, res: Response): void => {
      res.status(200).json({ data: service.restore(requireId(req)) });
    },

    purge: (req: Request, res: Response): void => {
      service.purge(requireId(req));
      res.status(204).send();
    },

    /**
     * Cek duplikat untuk form create agar user tahu sebelum menyimpan materi kembar.
     * Body minimal: { doi?, url? }.
     */
    checkDuplicates: (req: Request, res: Response): void => {
      const body = getValidated<{ doi?: string | null; url?: string | null }>(req, 'body');
      if (!body.doi && !body.url) {
        throw new ValidationError('Isi DOI atau URL untuk mengecek duplikat.');
      }

      const duplicate = service.findDuplicates(body);
      res.status(200).json({
        data: {
          hasDuplicate: duplicate !== null,
          duplicate: duplicate
            ? { id: duplicate.id, title: duplicate.title, doi: duplicate.doi, url: duplicate.url }
            : null,
        },
      });
    },
  };
}
