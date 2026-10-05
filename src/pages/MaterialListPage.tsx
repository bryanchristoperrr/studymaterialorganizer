import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { MaterialFilters, EMPTY_FILTERS, type MaterialFilterState } from '@/components/material/MaterialFilters';
import { MaterialList } from '@/components/material/MaterialList';
import { MaterialSearch } from '@/components/material/MaterialSearch';
import { useCourseOptions } from '@/hooks/useCourseOptions';
import { useMaterials } from '@/hooks/useMaterials';

/**
 * Halaman daftar materi.
 *
 * Seluruh state filter disimpan di URL query params supaya filter bisa
 * di-bookmark dan dibagikan, dan tombol "back" browser tetap bekerja.
 */
export function MaterialListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { courses, semesters, tags, loading: optionsLoading } = useCourseOptions();

  const getAll = (key: string): string[] => {
    const value = searchParams.getAll(key).flatMap((item) => item.split(','));
    return value.filter(Boolean);
  };

  const filters = {
    type: getAll('type'),
    status: getAll('status'),
    courseId: getAll('courseId'),
    semesterId: getAll('semesterId'),
    tagId: getAll('tagId'),
    importanceMin: searchParams.get('importanceMin') ?? '',
  } as MaterialFilterState;

  const search = searchParams.get('search') ?? '';
  const page = Number(searchParams.get('page') ?? '1');
  const sort = (searchParams.get('sort') ?? 'updatedAt') as 'updatedAt';
  const order = (searchParams.get('order') ?? 'desc') as 'desc';

  const updateParams = (patch: Record<string, string | string[] | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      // Hapus dulu, lalu tambahkan satu per satu — append(),
      // bukan set(), agar nilai array ganda tidak saling menimpa.
      next.delete(key);
      if (Array.isArray(value)) {
        for (const item of value) if (item) next.append(key, item);
      } else if (value) {
        next.append(key, value);
      }
    }
    // Setiap perubahan filter kembali ke halaman 1.
    next.delete('page');
    setSearchParams(next);
  };

  const [searchDraft, setSearchDraft] = useState(search);

  const query = useMemo(
    () => ({
      search: search || undefined,
      type: filters.type.length ? filters.type : undefined,
      status: filters.status.length ? filters.status : undefined,
      courseId: filters.courseId.length ? filters.courseId : undefined,
      semesterId: filters.semesterId.length ? filters.semesterId : undefined,
      tagId: filters.tagId.length ? filters.tagId : undefined,
      importanceMin: filters.importanceMin ? Number(filters.importanceMin) : undefined,
      sort,
      order,
      page,
      limit: 25,
    }),
    [search, filters, sort, order, page],
  );

  const { items, pagination, loading, error, reload } = useMaterials(query);

  const courseNameById = useMemo(
    () => new Map(courses.map((course) => [course.id, `${course.code} — ${course.name}`])),
    [courses],
  );

  const isFiltered =
    Boolean(search) ||
    filters.type.length > 0 ||
    filters.status.length > 0 ||
    filters.courseId.length > 0 ||
    filters.semesterId.length > 0 ||
    filters.tagId.length > 0 ||
    filters.importanceMin !== '';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Daftar Materi</h1>
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>
            Cari referensi berdasarkan semester, mata kuliah, atau kata kunci.
          </p>
        </div>
        <Link to="/materials/new">
          <Button>Tambah materi</Button>
        </Link>
      </div>

      {optionsLoading ? null : (
        <MaterialFilters
          value={filters}
          onChange={(next) => updateParams(next as unknown as Record<string, string | string[]>)}
          courses={courses}
          semesters={semesters}
          tags={tags}
          onReset={() => {
            setSearchDraft('');
            setSearchParams(new URLSearchParams());
          }}
        />
      )}

      <div className="toolbar">
        <MaterialSearch
          value={searchDraft}
          onChange={(value) => {
            setSearchDraft(value);
            updateParams({ search: value || undefined });
          }}
        />
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <MaterialList
        items={items}
        loading={loading}
        error={error}
        page={pagination?.page ?? 1}
        totalPages={pagination?.totalPages ?? 1}
        total={pagination?.total ?? 0}
        onPageChange={(nextPage) => {
          const next = new URLSearchParams(searchParams);
          next.set('page', String(nextPage));
          setSearchParams(next);
        }}
        onRetry={reload}
        courseNameById={courseNameById}
        isFiltered={isFiltered}
      />
    </>
  );
}

export { EMPTY_FILTERS };
