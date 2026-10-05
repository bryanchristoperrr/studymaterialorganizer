/**
 * Service course / semester / tag: sumber data untuk form filter dan
 * halaman CoursesPage.
 */
import { request } from './apiClient';
import type { Course, Semester, Tag } from '@/types';

export const courseService = {
  list(signal?: AbortSignal): Promise<Course[]> {
    return request<Course[]>('/courses', { signal });
  },

  create(input: Record<string, unknown>): Promise<Course> {
    return request<Course>('/courses', { method: 'POST', body: input });
  },

  update(id: string, input: Record<string, unknown>): Promise<Course> {
    return request<Course>(`/courses/${id}`, { method: 'PATCH', body: input });
  },

  remove(id: string): Promise<void> {
    return request<void>(`/courses/${id}`, { method: 'DELETE' });
  },
};

export const semesterService = {
  list(signal?: AbortSignal): Promise<Semester[]> {
    return request<Semester[]>('/semesters', { signal });
  },

  create(input: { term: 'ganjil' | 'genap'; year: number }): Promise<Semester> {
    return request<Semester>('/semesters', { method: 'POST', body: input });
  },
};

export const tagService = {
  list(signal?: AbortSignal): Promise<Tag[]> {
    return request<Tag[]>('/tags', { signal });
  },
};
