import type { ReactNode } from 'react';

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <span className="state" role="status">
      <span className="spinner" /> <span>{label}</span>
    </span>
  );
}

interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Keadaan kosong (belum ada data) — selalu memberi saran tindakan. */
export function EmptyState({ title, description, action }: StateProps) {
  return (
    <div className="state">
      <strong>{title}</strong>
      {description ? <p style={{ margin: '6px 0 12px' }}>{description}</p> : null}
      {action}
    </div>
  );
}

/** Keadaan error dengan aksi retry (bukan sekadar pesan server mentah). */
export function ErrorState({ title, description, action }: StateProps) {
  return (
    <div className="state state--error" role="alert">
      <strong>{title}</strong>
      {description ? <p style={{ margin: '6px 0 12px' }}>{description}</p> : null}
      {action}
    </div>
  );
}
