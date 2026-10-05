import { useState } from 'react';
import type { KeyboardEvent } from 'react';

interface TagInputProps {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

/**
 * Input tag sederhana: ketik + Enter (atau koma) untuk menambah, klik ✕ untuk
 * menghapus. Nilai dinormalisasi ke lowercase & unik di level komponen.
 */
export function TagInput({ id, values, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const cleaned = draft.trim().toLowerCase();
    if (cleaned && !values.includes(cleaned)) {
      onChange([...values, cleaned]);
    }
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div>
      <input
        id={id}
        className="input"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      {values.length > 0 ? (
        <div className="tag-list" style={{ marginTop: 8 }}>
          {values.map((value) => (
            <button
              key={value}
              type="button"
              className="badge badge--muted"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Hapus tag ${value}`}
            >
              {value} ✕
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
