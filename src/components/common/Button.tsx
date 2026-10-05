import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'medium' | 'small';
  children: ReactNode;
}

/** Tombol generik; seluruh styling mengikuti kelas global (styles/global.css). */
export function Button({ variant = 'primary', size = 'medium', children, ...rest }: ButtonProps) {
  const variantClass =
    variant === 'secondary' ? ' button--secondary' : variant === 'danger' ? ' button--danger' : '';
  const sizeClass = size === 'small' ? ' button--small' : '';

  return (
    <button type="button" className={`button${variantClass}${sizeClass}`} {...rest}>
      {children}
    </button>
  );
}
