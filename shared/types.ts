/**
 * Tipe domain yang dipakai bersama oleh frontend dan backend.
 * Sumber kebenaran tunggal: file ini (shared/types.ts).
 */

export const MATERIAL_TYPES = [
  'pdf',
  'web',
  'drive',
  'video',
  'book',
  'dataset',
  'slide',
  'other',
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_STATUSES = [
  'active',
  'archived',
  'dead',
  'duplicate',
  'reading',
] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const MATERIAL_LANGUAGES = ['id', 'en', 'other'] as const;
export type MaterialLanguage = (typeof MATERIAL_LANGUAGES)[number];

export const IMPORTANCE_MIN = 1;
export const IMPORTANCE_MAX = 5;
export const IMPORTANCE_DEFAULT = 2;
export type Importance = 1 | 2 | 3 | 4 | 5;

export interface Material {
  id: string;
  type: MaterialType;
  title: string;
  url: string | null;
  doi: string | null;
  sourceName: string | null;
  authors: string | null;
  publishedYear: number | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  language: MaterialLanguage | null;
  summary: string | null;
  importance: Importance;
  status: MaterialStatus;
  deadlineAt: string | null;
  version: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialWithRelations extends Material {
  courseIds: string[];
  tagNames: string[];
}

export interface Course {
  id: string;
  semesterId: string | null;
  code: string;
  name: string;
  lecturer: string | null;
  credits: number | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Semester {
  id: string;
  term: 'ganjil' | 'genap';
  year: number;
  label: string;
}

/**
 * Input create course yang ramah: field opsional (service mengisi
 * default-nya). z.output skema createCourseSchema dapat diassign
 * ke tipe ini karena memiliki semua field.
 */
export interface CourseInput {
  code: string;
  name: string;
  semesterId?: string | null;
  lecturer?: string | null;
  credits?: number | null;
  color?: string | null;
}

/** Input create semester: label opsional, dibentuk otomatis bila kosong. */
export interface SemesterInput {
  term: 'ganjil' | 'genap';
  year: number;
  label?: string;
}

/** Input update course: seluruh field opsional. */
export interface CoursePatch {
  code?: string;
  name?: string;
  semesterId?: string | null;
  lecturer?: string | null;
  credits?: number | null;
  color?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  materialCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiListSuccess<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
}
