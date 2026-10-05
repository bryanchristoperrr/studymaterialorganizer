import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/Modal';
import { ErrorState, Spinner } from '@/components/common/StateDisplay';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useCourseOptions } from '@/hooks/useCourseOptions';
import { materialService } from '@/services/materialService';
import { toUserMessage } from '@/services/apiError';
import { formatAuthors, formatDate, formatStatus, formatType } from '@/utils/format';

/** Halaman detail: seluruh metadata, aksi edit, dan hapus (soft delete). */
export function MaterialDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { courses } = useCourseOptions();
  const state = useAsyncData((signal) => materialService.getById(id, signal), [id]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (state.loading) return <Spinner label="Memuat detail materi…" />;

  if (state.error || !state.data) {
    return (
      <ErrorState
        title="Materi tidak ditemukan"
        description={state.error ?? undefined}
        action={
          <Link to="/materials">
            <Button variant="secondary">Kembali ke daftar</Button>
          </Link>
        }
      />
    );
  }

  const material = state.data;
  const courseNames = material.courseIds
    .map((courseId) => courses.find((course) => course.id === courseId))
    .filter((course): course is NonNullable<typeof course> => Boolean(course))
    .map((course) => `${course.code} — ${course.name}`);

  const handleDelete = async () => {
    setIsDeleting(true);
    setActionError(null);
    try {
      await materialService.remove(material.id);
      navigate('/materials');
    } catch (error) {
      setActionError(toUserMessage(error));
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1>{material.title}</h1>
          <div className="material-card__meta">
            <Badge>{formatType(material.type)}</Badge>
            <Badge>{formatStatus(material.status)}</Badge>
            <Badge tone="muted">{`v${material.version}`}</Badge>
            <span>Diperbarui {formatDate(material.updatedAt)}</span>
          </div>
        </div>
      </div>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <div className="card" style={{ marginTop: 16 }}>
        <dl className="detail-grid">
          <dt>URL</dt>
          <dd>
            {material.url ? (
              <a href={material.url} target="_blank" rel="noreferrer noopener">
                {material.url}
              </a>
            ) : (
              '-'
            )}
          </dd>

          <dt>DOI</dt>
          <dd>{material.doi ?? '-'}</dd>

          <dt>Sumber</dt>
          <dd>{material.sourceName ?? '-'}</dd>

          <dt>Penulis</dt>
          <dd>{formatAuthors(material.authors)}</dd>

          <dt>Tahun terbit</dt>
          <dd>{material.publishedYear ?? '-'}</dd>

          <dt>Publisher</dt>
          <dd>{material.publisher ?? '-'}</dd>

          <dt>Volume / issue / halaman</dt>
          <dd>
            {[material.volume, material.issue, material.pages].filter(Boolean).join(' / ') || '-'}
          </dd>

          <dt>Bahasa</dt>
          <dd>{material.language ?? '-'}</dd>

          <dt>Importance</dt>
          <dd>{material.importance} / 5</dd>

          <dt>Deadline</dt>
          <dd>{material.deadlineAt ? formatDate(material.deadlineAt) : '-'}</dd>

          <dt>Mata kuliah</dt>
          <dd>{courseNames.length > 0 ? courseNames.join(', ') : '-'}</dd>

          <dt>Tag</dt>
          <dd>
            <div className="tag-list">
              {material.tagNames.length > 0 ? (
                material.tagNames.map((tag) => <Badge key={tag} tone="muted">{tag}</Badge>)
              ) : (
                '-'
              )}
            </div>
          </dd>

          <dt>Ringkasan</dt>
          <dd>{material.summary ?? '-'}</dd>
        </dl>

        <div className="detail-actions">
          <Link to={`/materials/${material.id}/edit`}>
            <Button>Edit</Button>
          </Link>
          <Button variant="danger" onClick={() => setIsConfirmOpen(true)}>
            Hapus
          </Button>
          <Link to="/materials">
            <Button variant="secondary">Kembali</Button>
          </Link>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Hapus materi ini?"
        description={`"${material.title}" akan dipindahkan ke Recycle Bin dan bisa dipulihkan kapan saja.`}
        confirmLabel="Ya, hapus"
        tone="danger"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
