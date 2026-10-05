/**
 * Domain error yang dilempar service layer.
 * Controller memetakan kelas-kelas ini ke status HTTP (lihat middleware/errorHandler.ts),
 * sehingga HTTP tidak boleh bocor ke service/repository.
 */

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Array<{ field?: string; message: string }>;

  constructor(
    code: string,
    status: number,
    message: string,
    details?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** 404 — entitas tidak ada (termasuk yang sudah di-purge). */
export class NotFoundError extends AppError {
  constructor(message: string, details?: Array<{ field?: string; message: string }>) {
    super('NOT_FOUND', 404, message, details);
  }
}

/** 400 — melanggar aturan validasi. */
export class ValidationError extends AppError {
  constructor(message: string, details?: Array<{ field?: string; message: string }>) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

/** 409 — bentrok state: duplikat, kode course sama, atau version mismatch. */
export class ConflictError extends AppError {
  constructor(
    message: string,
    details?: Array<{ field?: string; message: string }>,
    code = 'CONFLICT',
  ) {
    super(code, 409, message, details);
  }
}

/** Error database — dibungkus 500 agar detail internal tidak bocor ke user. */
export class DatabaseError extends AppError {
  constructor(message: string) {
    super('DATABASE_ERROR', 500, message);
  }
}
