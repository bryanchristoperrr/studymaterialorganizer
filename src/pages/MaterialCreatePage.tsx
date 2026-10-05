import { useNavigate } from 'react-router-dom';
import { MaterialForm } from '@/components/material/MaterialForm';
import { useCourseOptions } from '@/hooks/useCourseOptions';
import { materialService } from '@/services/materialService';

/** Halaman tambah materi (mode create). */
export function MaterialCreatePage() {
  const navigate = useNavigate();
  const { courses } = useCourseOptions();

  return (
    <>
      <h1>Tambah Materi</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        Simpan tautan Google Drive, PDF, atau web beserta ringkasan singkatnya.
      </p>

      <div className="card">
        <MaterialForm
          mode="create"
          courses={courses}
          onCancel={() => navigate('/materials')}
          onSubmit={async (payload) => {
            const created = await materialService.create(payload);
            // Navigasi ke detail agar pengguna bisa langsung melihat
            // materi yang baru disimpan.
            navigate(`/materials/${created.id}`, { replace: true });
          }}
        />
      </div>
    </>
  );
}
