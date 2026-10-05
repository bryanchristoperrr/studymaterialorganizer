import type { ReactNode } from 'react';

interface AlertProps {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
  action?: ReactNode;
}

/** Pesan kontekstual di halaman/form (error server, sukses, info duplikat). */
export function Alert({ tone, children, action }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}
