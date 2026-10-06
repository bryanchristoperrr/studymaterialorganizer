/**
 * Skema Zod yang dipakai BOTH frontend (validasi form & query) dan backend
 * (validasi request). Satu sumber kebenaran agar aturan tidak berbeda dua sisi.
 *
 * Catatan: skema ini tidak boleh berisi logika bisnis (mis. deteksi duplikat) —
 * itu milik service layer. Skema hanya menjaga bentuk & batas nilai.
 */
import { z } from 'zod';
import {
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  MATERIAL_LANGUAGES,
  MATERIAL_STATUSES,
  MATERIAL_TYPES,
} from './types';

/**
 * String opsional: trim, '' -> null, panjang maksimal, null bila tidak diisi.
 * Sengaja memakai .optional().nullable().transform() (bukan preprocess) agar
 * tipe input tetap-known di TypeScript pada kedua sisi aplikasi.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .nullable()
    .optional()
    .transform((value: string | null | undefined) => (value === '' ? null : (value ?? null)));

/** String wajib: trim, panjang minimal & maksimal. */
const requiredText = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} wajib diisi` })
    .trim()
    .min(min, `${label} minimal ${min} karakter`)
    .max(max, `${label} maksimal ${max} karakter`);

/**
 * URL opsional: harus http/https dan punya host.
 * String kosong dari form diubah menjadi null SEBELUM validasi URL,
 * sehingga field yang dikosongkan tidak pernah gagal format.
 */
const optionalHttpUrl = z
  .union([z.literal(''), z.string()])
  .transform((value: string) => (value === '' ? null : value.trim()))
  .pipe(
    z
      .string()
      .trim()
      .max(2048, 'URL terlalu panjang')
      .url('Format URL tidak valid')
      .refine(
        (value: string) => /^https?:\/\//i.test(value),
        'URL harus diawali http:// atau https://',
      )
      .nullable(),
  )
  .optional();

/** DOI opsional: dinormalisasi ke bentuk '10.xxxx/yyy' sebelum divalidasi. */
const optionalDoi = z
  .string()
  .trim()
  .max(255, 'DOI terlalu panjang')
  .transform((value: string) =>
    value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase(),
  )
  .refine((value: string) => value === '' || /^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/.test(value), {
    message: 'Format DOI tidak valid (contoh: 10.1000/xyz123)',
  })
  .nullable()
  .optional()
  .transform((value: string | null | undefined) => (value === '' ? null : (value ?? null)));

/** Angka opsional: '' dari form html dianggap null. */
const optionalInteger = (min: number, max: number, label: string) =>
  z
    .union([z.coerce.number(), z.literal('')])
    .refine((value: number | string) => value === '' || (Number.isInteger(value) && Number(value) >= min && Number(value) <= max), {
      message: `${label} harus bilangan bulat antara ${min} dan ${max}`,
    })
    .nullable()
    .optional()
    .transform((value: number | string | null | undefined) => (value === '' || value === null || value === undefined ? null : Number(value)));

const importance = z.coerce
  .number({ invalid_type_error: 'Importance harus angka' })
  .int('Importance harus bilangan bulat')
  .min(IMPORTANCE_MIN, `Minimal ${IMPORTANCE_MIN}`)
  .max(IMPORTANCE_MAX, `Maksimal ${IMPORTANCE_MAX}`);

const currentYearPlusOne = new Date().getFullYear() + 1;

/* ------------------------------------------------------------------ */
/* Material                                                           */
/* ------------------------------------------------------------------ */

/** Field material sebagai ZodObject agar bisa di-derive (partial) untuk update. */
const materialFieldsSchema = z.object({
  type: z.enum(MATERIAL_TYPES),
  title: requiredText(3, 200, 'Judul'),
  url: optionalHttpUrl,
  doi: optionalDoi,
  sourceName: optionalText(200),
  authors: optionalText(2000),
  publishedYear: optionalInteger(1500, currentYearPlusOne, 'Tahun terbit'),
  publisher: optionalText(200),
  volume: optionalText(20),
  issue: optionalText(20),
  pages: optionalText(40),
  language: z.enum(MATERIAL_LANGUAGES).nullable().optional(),
  summary: optionalText(2000),
  importance: importance.optional(),
  status: z.enum(MATERIAL_STATUSES).optional(),
  deadlineAt: z
    .union([z.string().datetime({ offset: true }), z.literal(''), z.null()])
    .optional()
    .transform((value: string | null | undefined) => (value ? value : null)),
  courseIds: z.array(z.string().min(1)).max(20).optional(),
  tagNames: z.array(z.string().min(1)).max(20).optional(),
});

export const createMaterialSchema = materialFieldsSchema.superRefine((data: any, ctx: any) => {
  // B1: hanya 'book' yang boleh tanpa URL.
  if (data.type !== 'book' && !data.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: 'URL wajib diisi untuk tipe selain book',
    });
  }
});

export type CreateMaterialInput = z.output<typeof createMaterialSchema>;

/**
 * Update bersifat partial (PATCH) dan wajib menyertakan `version` (B8)
 * untuk mencegah lost update dari tab lain.
 */
export const updateMaterialSchema = materialFieldsSchema
  .partial()
  .extend({
    // Judul/url divalidasi ulang agar pesan error tetap konsisten dengan create.
    title: z
      .string()
      .trim()
      .min(3, 'Judul minimal 3 karakter')
      .max(200, 'Judul maksimal 200 karakter')
      .optional(),
    version: z.coerce
      .number({ invalid_type_error: 'Version wajib diisi' })
      .int('Version harus bilangan bulat')
      .min(1, 'Version minimal 1'),
  })
  .superRefine((data: any, ctx: any) => {
    // B1 tetap berlaku saat update: bila type bukan book, URL harus ada.
    if (data.type && data.type !== 'book' && data.url === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'URL wajib diisi untuk tipe selain book',
      });
    }
  });

export type UpdateMaterialInput = z.output<typeof updateMaterialSchema>;

/* ------------------------------------------------------------------ */
/* Query list material                                                */
/* ------------------------------------------------------------------ */

/** Terima 'a,b' maupun ['a','b'] (Express selalu mengirim string untuk query). */
const csvArray = z.preprocess((value: unknown) => {
  if (typeof value === 'string') return value.split(',').map((v) => v.trim());
  return value;
}, z.array(z.string().trim().min(1)).optional());

export const MATERIAL_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'title',
  'importance',
  'deadline',
  'status',
] as const;

export const materialsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: csvArray,
  courseId: csvArray,
  semesterId: csvArray,
  tagId: csvArray,
  status: csvArray,
  importanceMin: z.coerce.number().int().min(IMPORTANCE_MIN).max(IMPORTANCE_MAX).optional(),
  sort: z.enum(MATERIAL_SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  includeDeleted: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((value: boolean | string | undefined) => value === true || value === 'true'),
});

export type MaterialsQuery = z.output<typeof materialsQuerySchema>;

/* ------------------------------------------------------------------ */
/* Course & Semester                                                  */
/* ------------------------------------------------------------------ */

const courseCode = z
  .string()
  .trim()
  .min(2, 'Kode minimal 2 karakter')
  .max(20, 'Kode maksimal 20 karakter')
  .regex(/^[A-Za-z0-9-]+$/, 'Kode hanya boleh huruf, angka, dan strip')
  .transform((value: string) => value.toUpperCase());

export const createCourseSchema = z.object({
  code: courseCode,
  name: requiredText(3, 120, 'Nama mata kuliah'),
  semesterId: z.string().min(1).nullable().optional(),
  lecturer: optionalText(120),
  credits: optionalInteger(0, 12, 'SKS'),
  color: optionalText(9),
});

export type CreateCourseInput = z.output<typeof createCourseSchema>;

export const updateCourseSchema = createCourseSchema.partial();
export type UpdateCourseInput = z.output<typeof updateCourseSchema>;

export const createSemesterSchema = z.object({
  term: z.enum(['ganjil', 'genap']),
  year: z.coerce.number().int().min(2000).max(2100),
  // Label boleh kosong; server membentuknya dari term + year.
  label: z.string().trim().max(50).optional(),
});

export type CreateSemesterInput = z.infer<typeof createSemesterSchema>;