/**
 * Client HTTP tipis untuk backend.
 * Tanggung jawabnya hanya: memanggil API, mengubah error menjadi ApiError,
 * dan meneruskan AbortSignal agar request lama bisa dibatalkan.
 * Tidak ada state, tidak ada logika bisnis (lihat CONSTRAINTS.md).
 */
import { ApiError } from './apiError';
import type { ApiErrorBody, ApiListSuccess, ApiSuccess } from '@/types';

const BASE_URL = '/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
}

/** Ubah object query menjadi query string; array di-encode sebagai daftar berkoma. */
export function buildQueryString(
  query: RequestOptions['query'] = {},
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }

  const search = params.toString();
  return search ? `?${search}` : '';
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, query } = options;
  const url = `${BASE_URL}${path}${buildQueryString(query)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // Abort bukan error yang perlu ditampilkan ke pengguna.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.',
    });
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiListSuccess<T>
    | { error: ApiErrorBody }
    | null;

  if (!response.ok) {
    const errorBody = (payload as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(
      response.status,
      errorBody ?? { code: 'INTERNAL_ERROR', message: 'Permintaan gagal diproses.' },
    );
  }

  return (payload as ApiSuccess<T>).data;
}
