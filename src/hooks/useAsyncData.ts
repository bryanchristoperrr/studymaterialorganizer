/**
 * Hook generik untuk memuat data dari service layer.
 *
 * Catatan desain (CONSTRAINTS.md): TIDAK ada global state untuk data server.
 * Setiap halaman memanggil hook ini dengan filter sebagai argumen; saat filter
 * berubah, request lama dibatalkan (AbortController) dan data baru dimuat.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toUserMessage } from '@/services/apiError';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Muat ulang manual (tombol retry). */
  reload: () => void;
}

export function useAsyncData<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    loaderRef
      .current(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        // Request yang dibatalkan bukan error yang perlu ditampilkan.
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) setError(toUserMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps diberikan pemanggil.
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, loading, error, reload };
}
