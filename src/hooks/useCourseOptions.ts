import { useMemo } from 'react';
import { useAsyncData } from './useAsyncData';
import { courseService, semesterService, tagService } from '@/services/courseService';
import type { Course, Semester, Tag } from '@/types';

export interface CourseOptions {
  courses: Course[];
  semesters: Semester[];
  tags: Tag[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Opsi filter (mata kuliah, semester, tag) — dimuat sekali per halaman filter. */
export function useCourseOptions(): CourseOptions {
  const state = useAsyncData(async (signal) => {
    // Tiga request independen → dijalankan paralel, bukan waterfall.
    const [courses, semesters, tags] = await Promise.all([
      courseService.list(signal),
      semesterService.list(signal),
      tagService.list(signal),
    ]);
    return { courses, semesters, tags };
  }, []);

  return useMemo(
    () => ({
      courses: state.data?.courses ?? [],
      semesters: state.data?.semesters ?? [],
      tags: state.data?.tags ?? [],
      loading: state.loading,
      error: state.error,
      reload: state.reload,
    }),
    [state],
  );
}
