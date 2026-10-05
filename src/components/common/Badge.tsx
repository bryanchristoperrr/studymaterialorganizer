import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'danger';
  /** Tooltip native untuk konteks tambahan (mis. "Importance 4/5"). */
  title?: string;
}

/** Badge kecil untuk tipe/status/importance material. */
export function Badge({ children, tone = 'default', title }: BadgeProps) {
  const toneClass = tone === 'default' ? '' : ` badge--${tone}`;
  return (
    <span className={`badge${toneClass}`} title={title}>
      {children}
    </span>
  );
}
