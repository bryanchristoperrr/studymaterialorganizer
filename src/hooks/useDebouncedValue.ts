import { useEffect, useState } from 'react';

/**
 * Menunda nilai supaya tidak memicu request pada setiap ketikan.
 * Dipakai MaterialSearch (debounce 300 ms) agar tidak ada=request storm.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
