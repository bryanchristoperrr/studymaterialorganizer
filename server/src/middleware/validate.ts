/**
 * Middleware validasi: mem-parse req.body / req.query / req.params dengan skema Zod.
 * Hasil parse disimpan di `req.validated` sehingga controller hanya menerima data
 * yang sudah tervalidasi (validasi ganda bersama frontend).
 *
 * Catatan: `req.query` di Express merupakan getter yang tidak bisa di-assign,
 * karena itu hasil parse tidak ditulis balik ke req.query.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/errors';

export type Source = 'body' | 'query' | 'params';

/** Hasil validasi per sumber, dibaca controller lewat helper di bawah. */
export interface ValidatedRequest {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

export function getValidated<T>(req: Request, source: Source): T {
  return (req as Request & { validated?: ValidatedRequest }).validated?.[source] as T;
}

export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      next(new ValidationError('Data yang dikirim tidak valid.', details));
      return;
    }

    const request = req as Request & { validated?: ValidatedRequest };
    request.validated = { ...request.validated, [source]: result.data };
    next();
  };
}
