import { Link } from 'react-router-dom';
import { MaterialCard } from './MaterialCard';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, Spinner } from '@/components/common/StateDisplay';
import { Pagination } from '@/components/common/Pagination';
import type { MaterialWithRelations } from '@/types';

interface MaterialListProps {
  items: MaterialWithRelations[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  /** Peta courseId → nama course, dipakai untuk menampilkan label mata kuliah. */
  courseNameById: Map<string, string>;
  isFiltered: boolean;
}

/**
 * Daftar materi dengan state lengkap: loading, error (dengan retry), kosong,
 * dan sukses. Komponen ini tidak tahu apa pun tentang HTTP.
 */
export function MaterialList({
  items,
  loading,
  error,
  page,
  totalPages,
  total,
  onPageChange,
  onRetry,
  courseNameById,
  isFiltered,
}: MaterialListProps) {
  if (loading) return <Spinner label="Memuat materi…" />;

  if (error) {
    return (
      <ErrorState
        title="Gagal memuat daftar materi"
        description={error}
        action={
          <Button variant="secondary" onClick={onRetry}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return isFiltered ? (
      <EmptyState
        title="Tidak ada materi yang cocok"
        description="Coba longgarkan filter atau gunakan kata kunci lain."
      />
    ) : (
      <EmptyState
        title="Belum ada materi"
        description="Tambahkan tautan jurnal, PDF, atau Google Drive pertama kamu."
        action={
          <Link to="/materials/new">
            <Button>Tambah materi</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="material-list">
        {items.map((material) => (
          <MaterialCard
            key={material.id}
            material={material}
            courseNames={material.courseIds
              .map((courseId) => courseNameById.get(courseId))
              .filter((name): name is string => Boolean(name))}
          />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} />
    </>
  );
}
