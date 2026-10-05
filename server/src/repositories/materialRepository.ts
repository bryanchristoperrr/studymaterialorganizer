/**
 * Repository material: satu-satunya tempat yang menulis SQL untuk tabel
 * `materials` dan tabel relasinya. Tidak ada logika bisnis di sini —
 * hanya pemetaan baris, filter, dan pagination.
 *
 * Dialek PostgreSQL: parameter bernomor ($1, $2, …), NOW(),
 * ON CONFLICT DO NOTHING, dan ILIKE (case-insensitive seperti
 * SQLite LIKE).
 */
import type { Db, DbClient, QueryResult } from '../db/connection.js';
import { withTransaction } from '../db/transaction.js';
import type { MaterialsQuery } from '../../../shared/schemas.js';
import type {
  Importance,
  Material,
  MaterialLanguage,
  MaterialStatus,
  MaterialType,
  MaterialWithRelations,
} from '../../../shared/types.js';
import { DatabaseError } from '../utils/errors.js';

/** Bentuk baris mentah di tabel materials (snake_case). */
interface MaterialRow {
  id: string;
  type: string;
  title: string;
  url: string | null;
  doi: string | null;
  source_name: string | null;
  authors: string | null;
  published_year: number | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  language: string | null;
  summary: string | null;
  importance: number;
  status: string;
  deadline_at: string | null;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Kolom yang boleh dipakai untuk pengurutan (B11: allowlist, bukan input mentah). */
const SORT_COLUMNS: Record<MaterialsQuery['sort'], string> = {
  updatedAt: 'm.updated_at',
  createdAt: 'm.created_at',
  // lower() menggantikan COLLATE NOCASE (khas SQLite) agar
  // pengurutan tetap case-insensitive di PostgreSQL.
  title: 'lower(m.title)',
  importance: 'm.importance',
  deadline: 'm.deadline_at',
  status: 'm.status',
};

export type MaterialCreateRow = Omit<
  Material,
  'id' | 'version' | 'deletedAt' | 'createdAt' | 'updatedAt'
>;

export type MaterialUpdateRow = Partial<MaterialCreateRow>;

/**
 * Masukkan nilai ke daftar parameter dan kembalikan placeholder
 * bernomor ($n) untuk tiap nilai.
 */
function bind(params: unknown[], values: unknown[]): string[] {
  const start = params.length;
  params.push(...values);
  return values.map((_, index) => `$${start + index + 1}`);
}

/** pg mengembalikan Date untuk kolom TIMESTAMP; normalisasi ke string ISO. */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export class MaterialRepository {
  constructor(private readonly db: Db) {}

  /** Jalankan SELECT dan kembalikan baris bertipe. */
  private async select<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult = await this.db.query(text, params);
    return result.rows as unknown as T[];
  }

  /** Baris → entity domain (camelCase). */
  private static mapRow(row: MaterialRow): Material {
    return {
      id: row.id,
      type: row.type as MaterialType,
      title: row.title,
      url: row.url,
      doi: row.doi,
      sourceName: row.source_name,
      authors: row.authors,
      publishedYear: row.published_year,
      publisher: row.publisher,
      volume: row.volume,
      issue: row.issue,
      pages: row.pages,
      language: row.language as MaterialLanguage | null,
      summary: row.summary,
      importance: row.importance as Importance,
      status: row.status as MaterialStatus,
      deadlineAt: toIso(row.deadline_at),
      version: row.version,
      deletedAt: toIso(row.deleted_at),
      createdAt: toIso(row.created_at) ?? '',
      updatedAt: toIso(row.updated_at) ?? '',
    };
  }

  /**
   * Bangun klausa WHERE dari query yang sudah divalidasi skema.
   * Semua nilai masuk lewat parameter binding (tidak ada interpolasi string).
   */
  private static buildFilters(query: MaterialsQuery) {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!query.includeDeleted) {
      clauses.push('m.deleted_at IS NULL');
    }

    if (query.search) {
      // ILIKE = case-insensitive (SQLite LIKE juga case-insensitive
      // untuk ASCII). Nilai yang sama diulang 4x karena setiap
      // kolom memakai placeholder sendiri.
      const like = `%${query.search}%`;
      const ph = bind(params, [like, like, like, like]);
      clauses.push(
        `(m.title ILIKE ${ph[0]!} OR m.summary ILIKE ${ph[1]!} OR m.source_name ILIKE ${ph[2]!} OR m.authors ILIKE ${ph[3]!})`,
      );
    }

    if (query.type?.length) {
      const ph = bind(params, query.type);
      clauses.push(`m.type IN (${ph.join(',')})`);
    }

    if (query.status?.length) {
      const ph = bind(params, query.status);
      clauses.push(`m.status IN (${ph.join(',')})`);
    }

    if (query.importanceMin !== undefined) {
      const ph = bind(params, [query.importanceMin]);
      clauses.push(`m.importance >= ${ph[0]!}`);
    }

    if (query.courseId?.length) {
      const ph = bind(params, query.courseId);
      clauses.push(
        `m.id IN (SELECT material_id FROM material_courses WHERE course_id IN (${ph.join(',')}))`,
      );
    }

    if (query.semesterId?.length) {
      const ph = bind(params, query.semesterId);
      clauses.push(
        `m.id IN (
           SELECT mc.material_id
           FROM material_courses mc
           JOIN courses c ON c.id = mc.course_id
           WHERE c.semester_id IN (${ph.join(',')})
         )`,
      );
    }

    if (query.tagId?.length) {
      const ph = bind(params, query.tagId);
      clauses.push(
        `m.id IN (SELECT material_id FROM material_tags WHERE tag_id IN (${ph.join(',')}))`,
      );
    }

    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  /** List material + total untuk pagination, dilengkapi relasi course & tag. */
  async findMany(query: MaterialsQuery): Promise<{ items: MaterialWithRelations[]; total: number }> {
    const { where, params } = MaterialRepository.buildFilters(query);
    const sortColumn = SORT_COLUMNS[query.sort];
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (query.page - 1) * query.limit;

    try {
      // COUNT dijalankan dulu (parameter filter saja), baru query
      // utama yang menambahkan parameter LIMIT/OFFSET.
      const totalRows = await this.select<{ total: string | number }>(
        `SELECT COUNT(*) AS total FROM materials m ${where}`,
        params,
      );
      const total = Number(totalRows[0]?.total ?? 0);

      const limitPh = bind(params, [query.limit, offset]);
      const rows = await this.select<MaterialRow>(
        `SELECT m.* FROM materials m ${where}
         ORDER BY ${sortColumn} ${direction}, m.id ASC
         LIMIT ${limitPh[0]!} OFFSET ${limitPh[1]!}`,
        params,
      );

      const items = rows.map(MaterialRepository.mapRow) as MaterialWithRelations[];
      await this.attachRelations(items);
      return { items, total };
    } catch (error) {
      throw new DatabaseError(
        `Gagal membaca daftar material: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Ambil relasi course & tag untuk satu halaman hasil dalam DUA query —
   * bukan satu query per material (menghindari N+1, lihat CONSTRAINTS.md).
   */
  private async attachRelations(items: MaterialWithRelations[]): Promise<void> {
    if (items.length === 0) return;
    const ids = items.map((item) => item.id);
    const params: unknown[] = [];
    const ph = bind(params, ids);

    const courseRows = await this.select<{ material_id: string; course_id: string }>(
      `SELECT material_id, course_id FROM material_courses
       WHERE material_id IN (${ph.join(',')})`,
      params,
    );

    const tagRows = await this.select<{ material_id: string; name: string }>(
      `SELECT mt.material_id, t.name FROM material_tags mt
       JOIN tags t ON t.id = mt.tag_id
       WHERE mt.material_id IN (${ph.join(',')})`,
      params,
    );

    const coursesByMaterial = new Map<string, string[]>();
    for (const row of courseRows) {
      const list = coursesByMaterial.get(row.material_id) ?? [];
      list.push(row.course_id);
      coursesByMaterial.set(row.material_id, list);
    }

    const tagsByMaterial = new Map<string, string[]>();
    for (const row of tagRows) {
      const list = tagsByMaterial.get(row.material_id) ?? [];
      list.push(row.name);
      tagsByMaterial.set(row.material_id, list);
    }

    for (const item of items) {
      item.courseIds = coursesByMaterial.get(item.id) ?? [];
      item.tagNames = tagsByMaterial.get(item.id) ?? [];
    }
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<Material | null> {
    const includeDeleted = options.includeDeleted ?? false;
    const rows = await this.select<MaterialRow>(
      `SELECT * FROM materials
       WHERE id = $1 ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
      [id],
    );
    const row = rows[0];
    return row ? MaterialRepository.mapRow(row) : null;
  }

  /** Pencarian kandidat duplikat berdasarkan DOI (B6). */
  async findByDoi(doi: string, excludeId?: string): Promise<Material | null> {
    const rows = excludeId
      ? await this.select<MaterialRow>(
          'SELECT * FROM materials WHERE doi = $1 AND deleted_at IS NULL AND id != $2',
          [doi, excludeId],
        )
      : await this.select<MaterialRow>(
          'SELECT * FROM materials WHERE doi = $1 AND deleted_at IS NULL',
          [doi],
        );
    const row = rows[0];
    return row ? MaterialRepository.mapRow(row) : null;
  }

  /** Pencarian kandidat duplikat berdasarkan URL ternormalisasi (B2 + B6). */
  async findByUrl(url: string, excludeId?: string): Promise<Material | null> {
    const rows = excludeId
      ? await this.select<MaterialRow>(
          'SELECT * FROM materials WHERE url = $1 AND deleted_at IS NULL AND id != $2',
          [url, excludeId],
        )
      : await this.select<MaterialRow>(
          'SELECT * FROM materials WHERE url = $1 AND deleted_at IS NULL',
          [url],
        );
    const row = rows[0];
    return row ? MaterialRepository.mapRow(row) : null;
  }

  async insert(material: MaterialCreateRow & { id: string }): Promise<Material> {
    try {
      await this.db.query(
        `INSERT INTO materials (
           id, type, title, url, doi, source_name, authors, published_year,
           publisher, volume, issue, pages, language, summary, importance,
           status, deadline_at, version, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1,NOW(),NOW())`,
        [
          material.id,
          material.type,
          material.title,
          material.url,
          material.doi,
          material.sourceName,
          material.authors,
          material.publishedYear,
          material.publisher,
          material.volume,
          material.issue,
          material.pages,
          material.language,
          material.summary,
          material.importance,
          material.status,
          material.deadlineAt,
        ],
      );
    } catch (error) {
      throw new DatabaseError(
        `Gagal menyimpan material: ${(error as Error).message}`,
      );
    }
    return (await this.findById(material.id)) as Material;
  }

  /**
   * Update parsial + naikkan `version` (B8).
   * Patch hanya berisi field yang ada, jadi daftar kolom dibangun dari key.
   */
  async update(id: string, patch: MaterialUpdateRow): Promise<Material | null> {
    const columnByField: Record<string, string> = {
      type: 'type',
      title: 'title',
      url: 'url',
      doi: 'doi',
      sourceName: 'source_name',
      authors: 'authors',
      publishedYear: 'published_year',
      publisher: 'publisher',
      volume: 'volume',
      issue: 'issue',
      pages: 'pages',
      language: 'language',
      summary: 'summary',
      importance: 'importance',
      status: 'status',
      deadlineAt: 'deadline_at',
    };

    const entries = Object.entries(patch).filter(([field]) => columnByField[field]);
    if (entries.length === 0) return this.findById(id);

    const params: unknown[] = [];
    const setClause = entries
      .map(([field]) => {
        const ph = bind(params, [patch[field as keyof MaterialUpdateRow]]);
        return `${columnByField[field]} = ${ph[0]!}`;
      })
      .join(', ');
    params.push(id);
    const idPlaceholder = `$${params.length}`;

    try {
      const result = await this.db.query(
        `UPDATE materials
         SET ${setClause}, version = version + 1, updated_at = NOW()
         WHERE id = ${idPlaceholder} AND deleted_at IS NULL`,
        params,
      );

      if ((result.rowCount ?? 0) === 0) return null;
    } catch (error) {
      throw new DatabaseError(
        `Gagal memperbarui material: ${(error as Error).message}`,
      );
    }
    return this.findById(id);
  }

  /** B7: soft delete — item tetap tersimpan agar bisa di-restore. */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE materials SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async restore(id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE materials SET deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NOT NULL`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Hapus permanen; relasi course/tag terhapus otomatis oleh ON DELETE CASCADE. */
  async purge(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM materials WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /* -------------------- Relasi course & tag -------------------- */

  async findCourseIds(materialId: string): Promise<string[]> {
    const rows = await this.select<{ course_id: string }>(
      'SELECT course_id FROM material_courses WHERE material_id = $1',
      [materialId],
    );
    return rows.map((row) => row.course_id);
  }

  async findTagNames(materialId: string): Promise<string[]> {
    const rows = await this.select<{ name: string }>(
      `SELECT t.name FROM material_tags mt
       JOIN tags t ON t.id = mt.tag_id
       WHERE mt.material_id = $1
       ORDER BY t.name`,
      [materialId],
    );
    return rows.map((row) => row.name);
  }

  /** Ganti seluruh relasi course dalam satu transaksi. */
  async replaceCourseLinks(materialId: string, courseIds: string[]): Promise<void> {
    await withTransaction(this.db, async (client: DbClient) => {
      await client.query('DELETE FROM material_courses WHERE material_id = $1', [materialId]);
      for (const courseId of courseIds) {
        await client.query(
          'INSERT INTO material_courses (material_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [materialId, courseId],
        );
      }
    });
  }

  /** Ganti seluruh relasi tag dalam satu transaksi. */
  async replaceTagLinks(materialId: string, tagIds: string[]): Promise<void> {
    await withTransaction(this.db, async (client: DbClient) => {
      await client.query('DELETE FROM material_tags WHERE material_id = $1', [materialId]);
      for (const tagId of tagIds) {
        await client.query(
          'INSERT INTO material_tags (material_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [materialId, tagId],
        );
      }
    });
  }
}
