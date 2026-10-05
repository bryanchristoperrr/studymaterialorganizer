/**
 * Repository material: satu-satunya tempat yang menulis SQL untuk tabel
 * `materials` dan tabel relasinya. Tidak ada logika bisnis di sini —
 * hanya pemetaan baris, filter, dan pagination.
 */
import type { Db } from '../db/connection';
import type { MaterialsQuery } from '../../../shared/schemas';
import type {
  Importance,
  Material,
  MaterialLanguage,
  MaterialStatus,
  MaterialType,
  MaterialWithRelations,
} from '../../../shared/types';
import { DatabaseError } from '../utils/errors';

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
  title: 'm.title COLLATE NOCASE',
  importance: 'm.importance',
  deadline: 'm.deadline_at',
  status: 'm.status',
};

export type MaterialCreateRow = Omit<
  Material,
  'id' | 'version' | 'deletedAt' | 'createdAt' | 'updatedAt'
>;

export type MaterialUpdateRow = Partial<MaterialCreateRow>;

export class MaterialRepository {
  constructor(private readonly db: Db) {}

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
      deadlineAt: row.deadline_at,
      version: row.version,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      // Pencarian LIKE pada kolom yang relevan (FTS5 menyusul di fase M2).
      // Nilai yang sama diulang 4x karena setiap kolom memakai placeholder sendiri.
      clauses.push(
        '(m.title LIKE ? OR m.summary LIKE ? OR m.source_name LIKE ? OR m.authors LIKE ?)',
      );
      const like = `%${query.search}%`;
      params.push(like, like, like, like);
    }

    if (query.type?.length) {
      clauses.push(`m.type IN (${query.type.map(() => '?').join(',')})`);
      params.push(...query.type);
    }

    if (query.status?.length) {
      clauses.push(`m.status IN (${query.status.map(() => '?').join(',')})`);
      params.push(...query.status);
    }

    if (query.importanceMin !== undefined) {
      clauses.push('m.importance >= ?');
      params.push(query.importanceMin);
    }

    if (query.courseId?.length) {
      clauses.push(
        `m.id IN (SELECT material_id FROM material_courses WHERE course_id IN (${query.courseId
          .map(() => '?')
          .join(',')}))`,
      );
      params.push(...query.courseId);
    }

    if (query.semesterId?.length) {
      clauses.push(
        `m.id IN (
           SELECT mc.material_id
           FROM material_courses mc
           JOIN courses c ON c.id = mc.course_id
           WHERE c.semester_id IN (${query.semesterId.map(() => '?').join(',')})
         )`,
      );
      params.push(...query.semesterId);
    }

    if (query.tagId?.length) {
      clauses.push(
        `m.id IN (SELECT material_id FROM material_tags WHERE tag_id IN (${query.tagId
          .map(() => '?')
          .join(',')}))`,
      );
      params.push(...query.tagId);
    }

    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  /** List material + total untuk pagination, dilengkapi relasi course & tag. */
  findMany(query: MaterialsQuery): { items: MaterialWithRelations[]; total: number } {
    const { where, params } = MaterialRepository.buildFilters(query);
    const sortColumn = SORT_COLUMNS[query.sort];
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (query.page - 1) * query.limit;

    try {
      const totalRow = this.db
        .prepare(`SELECT COUNT(*) AS total FROM materials m ${where}`)
        .get(...params) as { total: number };

      const rows = this.db
        .prepare(
          `SELECT m.* FROM materials m ${where}
           ORDER BY ${sortColumn} ${direction}, m.id ASC
           LIMIT ? OFFSET ?`,
        )
        .all(...params, query.limit, offset) as MaterialRow[];

      const items = rows.map(MaterialRepository.mapRow) as MaterialWithRelations[];
      this.attachRelations(items);
      return { items, total: totalRow.total };
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
  private attachRelations(items: MaterialWithRelations[]): void {
    if (items.length === 0) return;
    const ids = items.map((item) => item.id);
    const placeholders = ids.map(() => '?').join(',');

    const courseRows = this.db
      .prepare(
        `SELECT material_id, course_id FROM material_courses
         WHERE material_id IN (${placeholders})`,
      )
      .all(...ids) as Array<{ material_id: string; course_id: string }>;

    const tagRows = this.db
      .prepare(
        `SELECT mt.material_id, t.name FROM material_tags mt
         JOIN tags t ON t.id = mt.tag_id
         WHERE mt.material_id IN (${placeholders})`,
      )
      .all(...ids) as Array<{ material_id: string; name: string }>;

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

  findById(id: string, options: { includeDeleted?: boolean } = {}): Material | null {
    const includeDeleted = options.includeDeleted ?? false;
    const row = this.db
      .prepare(
        `SELECT * FROM materials
         WHERE id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
      )
      .get(id) as MaterialRow | undefined;

    return row ? MaterialRepository.mapRow(row) : null;
  }

  /** Pencarian kandidat duplikat berdasarkan DOI (B6). */
  findByDoi(doi: string, excludeId?: string): Material | null {
    const row = this.db
      .prepare(
        `SELECT * FROM materials WHERE doi = ? AND deleted_at IS NULL
         ${excludeId ? 'AND id != ?' : ''}`,
      )
      .get(...(excludeId ? [doi, excludeId] : [doi])) as MaterialRow | undefined;
    return row ? MaterialRepository.mapRow(row) : null;
  }

  /** Pencarian kandidat duplikat berdasarkan URL ternormalisasi (B2 + B6). */
  findByUrl(url: string, excludeId?: string): Material | null {
    const row = this.db
      .prepare(
        `SELECT * FROM materials WHERE url = ? AND deleted_at IS NULL
         ${excludeId ? 'AND id != ?' : ''}`,
      )
      .get(...(excludeId ? [url, excludeId] : [url])) as MaterialRow | undefined;
    return row ? MaterialRepository.mapRow(row) : null;
  }

  insert(material: MaterialCreateRow & { id: string }): Material {
    try {
      this.db
        .prepare(
          `INSERT INTO materials (
             id, type, title, url, doi, source_name, authors, published_year,
             publisher, volume, issue, pages, language, summary, importance,
             status, deadline_at, version, created_at, updated_at
           ) VALUES (
             @id, @type, @title, @url, @doi, @sourceName, @authors, @publishedYear,
             @publisher, @volume, @issue, @pages, @language, @summary, @importance,
             @status, @deadlineAt, 1, datetime('now'), datetime('now')
           )`,
        )
        .run(material);
    } catch (error) {
      throw new DatabaseError(`Gagal menyimpan material: ${(error as Error).message}`);
    }
    return this.findById(material.id) as Material;
  }

  /**
   * Update parsial + naikkan `version` (B8).
   * Patch hanya berisi field yang ada, jadi daftar kolom dibangun dari key.
   */
  update(id: string, patch: MaterialUpdateRow): Material | null {
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

    const setClause = entries.map(([field]) => `${columnByField[field]} = @${field}`).join(', ');

    try {
      const result = this.db
        .prepare(
          `UPDATE materials
           SET ${setClause}, version = version + 1, updated_at = datetime('now')
           WHERE id = @id AND deleted_at IS NULL`,
        )
        .run({ ...patch, id });

      if (result.changes === 0) return null;
    } catch (error) {
      throw new DatabaseError(`Gagal memperbarui material: ${(error as Error).message}`);
    }
    return this.findById(id);
  }

  /** B7: soft delete — item tetap tersimpan agar bisa di-restore. */
  softDelete(id: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE materials SET deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(id);
    return result.changes > 0;
  }

  restore(id: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE materials SET deleted_at = NULL, updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NOT NULL`,
      )
      .run(id);
    return result.changes > 0;
  }

  /** Hapus permanen; relasi course/tag terhapus otomatis oleh ON DELETE CASCADE. */
  purge(id: string): boolean {
    const result = this.db.prepare('DELETE FROM materials WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /* -------------------- Relasi course & tag -------------------- */

  findCourseIds(materialId: string): string[] {
    const rows = this.db
      .prepare('SELECT course_id FROM material_courses WHERE material_id = ?')
      .all(materialId) as Array<{ course_id: string }>;
    return rows.map((row) => row.course_id);
  }

  findTagNames(materialId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT t.name FROM material_tags mt
         JOIN tags t ON t.id = mt.tag_id
         WHERE mt.material_id = ?
         ORDER BY t.name`,
      )
      .all(materialId) as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }

  /** Ganti seluruh relasi course dalam satu transaksi. */
  replaceCourseLinks(materialId: string, courseIds: string[]): void {
    const run = this.db.transaction((ids: string[]) => {
      this.db.prepare('DELETE FROM material_courses WHERE material_id = ?').run(materialId);
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO material_courses (material_id, course_id) VALUES (?, ?)',
      );
      for (const courseId of ids) insert.run(materialId, courseId);
    });
    run(courseIds);
  }

  /** Ganti seluruh relasi tag dalam satu transaksi. */
  replaceTagLinks(materialId: string, tagIds: string[]): void {
    const run = this.db.transaction((ids: string[]) => {
      this.db.prepare('DELETE FROM material_tags WHERE material_id = ?').run(materialId);
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO material_tags (material_id, tag_id) VALUES (?, ?)',
      );
      for (const tagId of ids) insert.run(materialId, tagId);
    });
    run(tagIds);
  }
}
