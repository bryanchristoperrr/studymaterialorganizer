import { Link } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { formatAuthors, formatDate, formatStatus, formatType, truncate } from '@/utils/format';
import type { Material, MaterialStatus } from '@/types';

interface MaterialCardProps {
  material: Material;
  courseNames?: string[];
}

/** Warna badge mengikuti status agar cepat dipindai mata. */
function statusTone(status: MaterialStatus): 'default' | 'muted' | 'success' | 'warning' | 'danger' {
  if (status === 'dead') return 'danger';
  if (status === 'duplicate') return 'warning';
  if (status === 'archived') return 'muted';
  if (status === 'reading') return 'warning';
  return 'success';
}

/** Importance 1–5 → bintang (★) untuk pemindaian cepat. */
function importanceStars(importance: number): string {
  return '★'.repeat(importance) + '☆'.repeat(5 - importance);
}

/** Deadline lewat → badge merah "lewat". */
function isOverdue(deadlineAt: string | null): boolean {
  if (!deadlineAt) return false;
  return new Date(deadlineAt).getTime() < Date.now();
}

/** Ringkasan satu materi di daftar: judul, tipe, status, sumber, tanggal. */
export function MaterialCard({ material, courseNames = [] }: MaterialCardProps) {
  const overdue = isOverdue(material.deadlineAt);

  return (
    <article className="material-card">
      <h3 className="material-card__title">
        <Link to={`/materials/${material.id}`}>{material.title}</Link>
      </h3>

      <div className="material-card__meta">
        <Badge>{formatType(material.type)}</Badge>
        <Badge tone={statusTone(material.status)}>{formatStatus(material.status)}</Badge>
        <Badge tone="muted" title={`Importance ${material.importance}/5`}>
          {importanceStars(material.importance)}
        </Badge>
        {material.deadlineAt ? (
          <Badge tone={overdue ? 'danger' : 'warning'}>
            {overdue ? 'Lewat: ' : ''}
            {formatDate(material.deadlineAt)}
          </Badge>
        ) : null}
        <span>Diperbarui {formatDate(material.updatedAt)}</span>
      </div>

      {material.summary ? (
        <p className="material-card__summary">{truncate(material.summary, 180)}</p>
      ) : null}

      <div className="material-card__meta" style={{ marginTop: 9 }}>
        {material.sourceName ? <span>Sumber: {material.sourceName}</span> : null}
        {material.authors ? (
          <span>Penulis: {truncate(formatAuthors(material.authors), 60)}</span>
        ) : null}
        {material.doi ? <span>DOI: {material.doi}</span> : null}
        {courseNames.length > 0 ? (
          <span>Mata kuliah: {courseNames.join(', ')}</span>
        ) : null}
      </div>
    </article>
  );
}
