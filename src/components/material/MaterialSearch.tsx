import { useEffect, useState } from 'react';
import { Input } from '@/components/common/Input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface MaterialSearchProps {
  /** Nilai hasil debounce — inilah yang dipakai halaman untuk fetch. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Input pencarian materi dengan debounce 300 ms.
 * Teks yang diketik tampil langsung (UX), tetapi `onChange` baru dipanggil
 * setelah tidak ada ketikan selama 300 ms → satu request per jeda ketikan.
 */
export function MaterialSearch({ value, onChange }: MaterialSearchProps) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, 300);

  // Sinkronkan bila nilai dari luar berubah (mis. filter di-reset).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja hanya pada debounced.
  }, [debounced]);

  return (
    <div className="filters__field" style={{ flex: 1, minWidth: 220 }}>
      <label className="filters__label" htmlFor="material-search">
        Cari materi
      </label>
      <Input
        id="material-search"
        type="search"
        placeholder="Judul, ringkasan, penulis, atau sumber…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
