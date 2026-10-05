import type { ReactNode } from 'react';
import { useId } from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}

/**
 * Pembungkus satu field form: label + kontrol + pesan error.
 * Pesan error selalu dikaitkan via aria-describedby agar bisa dibaca screen reader.
 */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const errorId = `${controlId}-error`;
  const hintId = `${controlId}-hint`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={controlId}>
        {label}
      </label>
      {children}
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
