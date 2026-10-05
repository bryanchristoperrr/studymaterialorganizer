/**
 * Service material — tempat semua aturan bisnis material hidup.
 * Repository hanya tahu cara baca/tulis; service tahu aturan mana yang berlaku.
 *
 * Aturan yang diimplementasikan (lihat ARCHITECTURE.md):
 * B1 URL wajib kecuali type 'book'
 * B2 normalisasi URL
 * B3 inferensi tipe dari host (Google Drive)
 * B4 normalisasi DOI
 * B5 tahun terbit tidak di masa depan
 * B6 deteksi duplikat (DOI / URL) → 409
 * B7 soft delete, restore, purge
 * B8 optimistic concurrency via `version`
 * B9 auto-create tag
 */
import { randomUUID } from 'node:crypto';
import type {
  CreateMaterialInput,
  MaterialsQuery,
  UpdateMaterialInput,
} from '../../../shared/schemas';
import {
  IMPORTANCE_DEFAULT,
  type Material,
  type MaterialLanguage,
  type MaterialStatus,
  type MaterialType,
  type Importance,
} from '../../../shared/types';
import type { CourseRepository } from '../repositories/courseRepository';
import type { MaterialCreateRow, MaterialRepository } from '../repositories/materialRepository';
import type { TagRepository } from '../repositories/tagRepository';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { inferTypeFromUrl, normalizeAuthors, normalizeDoi, normalizeUrl } from '../utils/normalize';

/** Bentuk input setelah dinormalisasi, sebelum masuk repository. */
interface NormalizedMaterial {
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
}

/**
 * Ambil nilai field dari input bila dikirim, atau dari material lama saat update.
 * `undefined` berarti "tidak diubah"; `null` berarti "dikosongkan".
 */
function pickField<T>(field: string, input: object, fallback: T | null | undefined): T | null {
  const value = (input as Record<string, unknown>)[field];
  if (value === undefined) return fallback ?? null;
  return value as T;
}

export class MaterialService {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly courses: CourseRepository,
    private readonly tags: TagRepository,
  ) {}

  /* ------------------------------- Read ------------------------------- */

  /** List + pagination info untuk response API. */
  list(query: MaterialsQuery) {
    const { items, total } = this.materials.findMany(query);
    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      items,
      pagination: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  /** Detail material, termasuk course & tag terkait. */
  getById(id: string) {
    const material = this.materials.findById(id, { includeDeleted: true });
    if (!material) {
      throw new NotFoundError(`Material dengan id "${id}" tidak ditemukan.`);
    }
    if (material.deletedAt) {
      throw new NotFoundError(
        `Material "${material.title}" berada di Recycle Bin. Restore dulu untuk melihatnya.`,
      );
    }

    return {
      ...material,
      courseIds: this.materials.findCourseIds(id),
      tagNames: this.materials.findTagNames(id),
    };
  }

  /* ------------------------------ Create ------------------------------ */

  create(input: CreateMaterialInput): Material {
    const normalized = this.normalizeInput(input);

    this.assertNoDuplicate({ doi: normalized.doi, url: normalized.url });
    const courseIds = this.resolveCourseIds(input.courseIds);
    const tagIds = this.resolveTagIds(input.tagNames ?? []);

    const row: MaterialCreateRow & { id: string } = { id: `m_${randomUUID()}`, ...normalized };
    const material = this.materials.insert(row);

    // Relasi ditulis setelah row utama ada (foreign key).
    this.materials.replaceCourseLinks(material.id, courseIds);
    this.materials.replaceTagLinks(material.id, tagIds);

    return material;
  }

  /* ------------------------------ Update ------------------------------ */

  update(id: string, input: UpdateMaterialInput): Material {
    const existing = this.materials.findById(id);
    if (!existing) {
      throw new NotFoundError(`Material dengan id "${id}" tidak ditemukan.`);
    }

    // B8: version mismatch berarti tab lain sudah menyimpan perubahan lebih dulu.
    if (existing.version !== input.version) {
      throw new ConflictError(
        'Material sudah diubah di tempat lain. Muat ulang data lalu coba lagi.',
        [
          {
            field: 'version',
            message: `diminta: ${input.version}, sekarang: ${existing.version}`,
          },
        ],
        'VERSION_CONFLICT',
      );
    }

    const normalized = this.normalizeInput(input, existing);
    this.assertNoDuplicate({ doi: normalized.doi, url: normalized.url }, id);

    // Relasi hanya ditulis ulang bila field-nya benar-benar dikirim,
    // supaya PATCH sebagian tidak menghapus relasi lama.
    const courseIds =
      input.courseIds === undefined
        ? this.materials.findCourseIds(id)
        : this.resolveCourseIds(input.courseIds);
    const tagIds =
      input.tagNames === undefined
        ? this.materials.findTagNames(id).map((name) => this.ensureTagId(name))
        : this.resolveTagIds(input.tagNames);

    const updated = this.materials.update(id, normalized);
    if (!updated) {
      throw new NotFoundError(`Material dengan id "${id}" tidak ditemukan.`);
    }

    this.materials.replaceCourseLinks(id, courseIds);
    this.materials.replaceTagLinks(id, tagIds);

    return updated;
  }

  /* --------------------------- Delete family -------------------------- */

  /** B7: soft delete — item pindah ke Recycle Bin, tidak hilang permanen. */
  softDelete(id: string): void {
    const material = this.materials.findById(id);
    if (!material) {
      throw new NotFoundError(`Material dengan id "${id}" tidak ditemukan.`);
    }
    this.materials.softDelete(id);
  }

  restore(id: string): Material {
    const material = this.materials.findById(id, { includeDeleted: true });
    if (!material) {
      throw new NotFoundError(`Material dengan id "${id}" tidak ditemukan.`);
    }
    if (!material.deletedAt) {
      throw new ConflictError('Material ini tidak ada di Recycle Bin.');
    }
    this.materials.restore(id);
    return this.materials.findById(id) as Material;
  }

  purge(id: string): void {
    const material = this.materials.findById(id, { includeDeleted: true });
    if (!material) {
      throw new NotFoundError(`Material dengan id "${id}" tidak ditemukan.`);
    }
    this.materials.purge(id);
  }

  /**
   * Kandidat duplikat berdasarkan DOI / URL ternormalisasi.
   * Dipakai endpoint duplicate-check agar form bisa memberi peringatan dini.
   */
  findDuplicates(criteria: { doi?: string | null; url?: string | null }): Material | null {
    const doi = normalizeDoi(criteria.doi ?? null);
    const url = normalizeUrl(criteria.url ?? null);
    if (!doi && !url) return null;
    return (doi ? this.materials.findByDoi(doi) : null) ?? (url ? this.materials.findByUrl(url) : null);
  }

  /* --------------------------- Helper internals ------------------------ */

  /**
   * Rapikan input sebelum disimpan: normalisasi, default, dan validasi antar-field.
   * `existing` diisi saat update agar field yang tidak dikirim tetap utuh.
   */
  private normalizeInput(
    input: CreateMaterialInput | UpdateMaterialInput,
    existing?: Material,
  ): NormalizedMaterial {
    const rawUrl = 'url' in input ? input.url : existing?.url;
    const url = normalizeUrl(rawUrl ?? null);
    if (rawUrl && !url) {
      throw new ValidationError('URL tidak valid.', [
        { field: 'url', message: 'URL tidak valid' },
      ]);
    }

    // B3: bila tipe tidak dipilih SAAT CREATE, coba simpulkan dari host URL.
    // Saat update, tipe yang sudah ada dipertahankan kecuali dikirim eksplisit
    // (tanpa ini, PATCH ringkasan akan mengubah tipe pd->drive secara diam-diam).
    const explicitType = (input as CreateMaterialInput).type;
    const type: MaterialType =
      explicitType ??
      (existing
        ? existing.type
        : (inferTypeFromUrl(url) as MaterialType | null)) ??
      'other';

    const publishedYear = pickField<number>('publishedYear', input, existing?.publishedYear);
    if (publishedYear !== null && publishedYear > new Date().getFullYear() + 1) {
      throw new ValidationError('Tahun terbit tidak valid.', [
        { field: 'publishedYear', message: 'Tahun terbit tidak boleh di masa depan' },
      ]);
    }

    // B1: hanya buku yang boleh tanpa URL.
    if (type !== 'book' && !url) {
      throw new ValidationError('URL wajib diisi.', [
        { field: 'url', message: 'URL wajib diisi untuk tipe selain book' },
      ]);
    }

    return {
      type,
      title: pickField<string>('title', input, existing?.title) as string,
      url,
      doi: normalizeDoi(pickField<string>('doi', input, existing?.doi)),
      sourceName: pickField<string>('sourceName', input, existing?.sourceName),
      authors: normalizeAuthors(pickField<string>('authors', input, existing?.authors)),
      publishedYear,
      publisher: pickField<string>('publisher', input, existing?.publisher),
      volume: pickField<string>('volume', input, existing?.volume),
      issue: pickField<string>('issue', input, existing?.issue),
      pages: pickField<string>('pages', input, existing?.pages),
      language: pickField<MaterialLanguage>('language', input, existing?.language),
      summary: pickField<string>('summary', input, existing?.summary),
      importance: pickField<Importance>('importance', input, existing?.importance) ?? IMPORTANCE_DEFAULT,
      status: pickField<MaterialStatus>('status', input, existing?.status) ?? 'active',
      deadlineAt: pickField<string>('deadlineAt', input, existing?.deadlineAt),
    };
  }

  /** B6: DOI atau URL yang sudah dipakai material lain → 409. */
  private assertNoDuplicate(
    criteria: { doi?: string | null; url?: string | null },
    excludeId?: string,
  ): void {
    if (criteria.doi) {
      const existing = this.materials.findByDoi(criteria.doi, excludeId);
      if (existing) {
        throw new ConflictError(
          'Materi dengan DOI yang sama sudah ada.',
          [
            {
              field: 'doi',
              message: `Sudah digunakan oleh "${existing.title}" (${existing.id})`,
            },
          ],
          'DUPLICATE_MATERIAL',
        );
      }
    }

    if (criteria.url) {
      const existing = this.materials.findByUrl(criteria.url, excludeId);
      if (existing) {
        throw new ConflictError(
          'Materi dengan URL yang sama sudah ada.',
          [
            {
              field: 'url',
              message: `Sudah digunakan oleh "${existing.title}" (${existing.id})`,
            },
          ],
          'DUPLICATE_MATERIAL',
        );
      }
    }
  }

  /** Pastikan semua courseIds benar-benar ada sebelum relasi ditulis. */
  private resolveCourseIds(courseIds: string[] | undefined): string[] {
    if (!courseIds || courseIds.length === 0) return [];
    const unique = [...new Set(courseIds)];
    const existing = this.courses.findExistingIds(unique);

    const missing = unique.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw new ValidationError('Mata kuliah tidak ditemukan.', [
        { field: 'courseIds', message: `ID mata kuliah tidak dikenal: ${missing.join(', ')}` },
      ]);
    }
    return unique;
  }

  /** B9: tag baru dibuat otomatis, tag lama dipakai kembali. */
  private resolveTagIds(tagNames: string[]): string[] {
    const names = [...new Set(tagNames.map((name) => name.trim().toLowerCase()).filter(Boolean))];
    return names.map((name) => this.ensureTagId(name));
  }

  private ensureTagId(name: string): string {
    const normalized = name.trim().toLowerCase();
    const existing = this.tags.findByName(normalized);
    return existing ? existing.id : this.tags.insert({ id: `t_${randomUUID()}`, name: normalized }).id;
  }
}
