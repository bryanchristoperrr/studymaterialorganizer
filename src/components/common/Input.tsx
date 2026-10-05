import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

interface BaseProps {
  id: string;
  error?: string | undefined;
  hint?: string;
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode };

/** Input teks dengan penanda aria-invalid + aria-describedby yang konsisten. */
export function Input({ id, error, hint, ...rest }: InputProps) {
  return (
    <input
      id={id}
      className="input"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  );
}

export function Textarea({ id, error, hint, ...rest }: TextareaProps) {
  return (
    <textarea
      id={id}
      className="textarea"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  );
}

/** Select native — cukup untuk daftar opsi pendek (tipe, status, importance). */
export function Select({ id, error, hint, children, ...rest }: SelectProps) {
  return (
    <select
      id={id}
      className="select"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      {...rest}
    >
      {children}
    </select>
  );
}
