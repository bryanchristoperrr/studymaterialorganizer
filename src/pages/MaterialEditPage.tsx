import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState, Spinner } from '@/components/common/StateDisplay';
import { MaterialForm } from '@/components/material/MaterialForm';
import { useCourseOptions } from '@/hooks/useCourseOptions';
import { useAsyncData } from '@/hooks/useAsyncData';
import { materialService } from '@/services/materialService';

/**
 * Halaman edit materi. Data dimuat dulu agar form terisi dan `version` saat
 * ini tersimpan — PATCH mengirim version itu untuk mendeteksi konflik (B8).
 */
export function MaterialEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { courses } = useCourseOptions();
  const state = useAsyncData((signal) => materialService.getById(id, signal), [id]);

  if (state.loading) return <Spinner label="Memuat materi…" />;

  if (state.error || !state.data) {
    return (
      <ErrorState
        title="Materi tidak dapat dimuat"
        description={state.error ?? undefined}
        action={
          <button type="button" className="button button--secondary" onClick={state.reload}>
            Coba lagi
          </button>
        }
      />
    );
  }

  const material = state.data;

  return (
    <>
      <h1>Edit Materi</h1>
      <div className="card">
        <MaterialForm
          mode="edit"
          material={material}
          courses={courses}
          onCancel={() => navigate(`/materials/${material.id}`)}
          onSubmit={async (payload) => {
            await materialService.update(material.id, payload);
            navigate(`/materials/${material.id}`);
          }}
        />
      </div>
    </>
  );
}
