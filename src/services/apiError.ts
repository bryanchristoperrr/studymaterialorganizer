/**
 * Error domain di sisi frontend.
 * `ApiError` membawa status, code, dan error per-field dari server agar
 * form bisa menampilkan pesan tepat di field yang bermasalah tanpa
 * pernah menampilkan stack trace.
 */
import type { ApiErrorBody } from '@/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;

    // Petakan details[].field menjadi object agar form mudah acces.
    this.fieldErrors = {};
    for (const detail of body.details ?? []) {
      if (detail.field) this.fieldErrors[detail.field] = detail.message;
    }
  }
}

/** Pesan yang aman ditampilkan ke pengguna untuk error tak terduga. */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return 'Terjadi kesalahan. Coba lagi beberapa saat lagi.';
  return 'Terjadi kesalahan yang tidak diketahui.';
}
