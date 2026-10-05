/**
 * Error handler global. Menyeragamkan semua error menjadi envelope:
 *   { "error": { "code", "message", "details"? } }
 * Error 500 hanya menampilkan pesan generik; detail internal ditulis ke log
 * вместе requestId supaya bisa ditelusuri tanpa membocorkan internals.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { randomUUID } from 'node:crypto';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
    },
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = randomUUID();

  // JSON tidak valid → perlakukan sebagai bad request, bukan crash.
  // body-parser memberi error SyntaxError dengan type 'entity.parse.failed'.
  const isJsonParseError =
    error instanceof SyntaxError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { type?: string }).type === 'entity.parse.failed');
  if (isJsonParseError) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Body JSON tidak valid.', requestId },
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      // eslint-disable-next-line no-console -- log server, bukan pesan ke user.
      console.error(`[${requestId}] ${req.method} ${req.originalUrl}`, error);
    }
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        ...(error.status >= 500 ? { requestId } : {}),
      },
    });
    return;
  }

  // eslint-disable-next-line no-console -- log server.
  console.error(`[${requestId}] ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.',
      requestId,
    },
  });
}
