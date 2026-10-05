/**
 * Repository course & semester: akses data murni untuk tabel `courses` dan
 * `semesters`. Tidak ada validasi bisnis (mis. duplikasi kode dicek di service).
 *
 * Dialek PostgreSQL: parameter bernomor ($1, $2, …) dan NOW().
 */
import type { Db, QueryResult } from '../db/connection.js';
import type { Course, Semester } from '../../../shared/types.js';
import { DatabaseError } from '../utils/errors.js';

interface CourseRow {
  id: string;
  semester_id: string | null;
  code: string;
  name: string;
  lecturer: string | null;
  credits: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

interface SemesterRow {
  id: string;
  term: string;
  year: number;
  label: string;
}

export type CourseRowInput = Omit<Course, 'id' | 'createdAt' | 'updatedAt'>;
export type CourseUpdateInput = Partial<CourseRowInput>;

/** pg mengembalikan Date untuk kolom TIMESTAMP; normalisasi ke string ISO. */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export class CourseRepository {
  constructor(private readonly db: Db) {}

  /** Jalankan SELECT dan kembalikan baris bertipe. */
  private async select<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult = await this.db.query(text, params);
    return result.rows as unknown as T[];
  }

  private static mapRow(row: CourseRow): Course {
    return {
      id: row.id,
      semesterId: row.semester_id,
      code: row.code,
      name: row.name,
      lecturer: row.lecturer,
      credits: row.credits,
      color: row.color,
      createdAt: toIso(row.created_at) ?? '',
      updatedAt: toIso(row.updated_at) ?? '',
    };
  }

  async findAll(): Promise<Course[]> {
    try {
      const rows = await this.select<CourseRow>('SELECT * FROM courses ORDER BY code ASC');
      return rows.map(CourseRepository.mapRow);
    } catch (error) {
      throw new DatabaseError(
        `Gagal membaca daftar mata kuliah: ${(error as Error).message}`,
      );
    }
  }

  async findById(id: string): Promise<Course | null> {
    const rows = await this.select<CourseRow>('SELECT * FROM courses WHERE id = $1', [id]);
    const row = rows[0];
    return row ? CourseRepository.mapRow(row) : null;
  }

  async findByCode(code: string): Promise<Course | null> {
    const rows = await this.select<CourseRow>('SELECT * FROM courses WHERE code = $1', [
      code.toUpperCase(),
    ]);
    const row = rows[0];
    return row ? CourseRepository.mapRow(row) : null;
  }

  /** Kembalikan ID course yang valid saja — dipakai service sebelum insert relasi. */
  async findExistingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const rows = await this.select<{ id: string }>(
      `SELECT id FROM courses WHERE id IN (${placeholders})`,
      ids,
    );
    return new Set(rows.map((row) => row.id));
  }

  async insert(course: CourseRowInput & { id: string }): Promise<Course> {
    try {
      await this.db.query(
        `INSERT INTO courses (id, semester_id, code, name, lecturer, credits, color,
                              created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          course.id,
          course.semesterId,
          course.code,
          course.name,
          course.lecturer,
          course.credits,
          course.color,
        ],
      );
    } catch (error) {
      throw new DatabaseError(
        `Gagal menyimpan mata kuliah: ${(error as Error).message}`,
      );
    }
    return (await this.findById(course.id)) as Course;
  }

  async update(id: string, patch: CourseUpdateInput): Promise<Course | null> {
    const columnByField: Record<string, string> = {
      semesterId: 'semester_id',
      code: 'code',
      name: 'name',
      lecturer: 'lecturer',
      credits: 'credits',
      color: 'color',
    };
    const entries = Object.entries(patch).filter(([field]) => columnByField[field]);
    if (entries.length === 0) return this.findById(id);

    const params: unknown[] = [];
    const setClause = entries
      .map(([field]) => {
        const phIndex = params.push(patch[field as keyof CourseUpdateInput]);
        return `${columnByField[field]} = $${phIndex}`;
      })
      .join(', ');
    params.push(id);
    const idPlaceholder = `$${params.length}`;

    try {
      const result = await this.db.query(
        `UPDATE courses SET ${setClause}, updated_at = NOW() WHERE id = ${idPlaceholder}`,
        params,
      );
      if ((result.rowCount ?? 0) === 0) return null;
    } catch (error) {
      throw new DatabaseError(
        `Gagal memperbarui mata kuliah: ${(error as Error).message}`,
      );
    }
    return this.findById(id);
  }

  /**
   * Hapus mata kuliah. Relasi di material_courses dihapus (CASCADE), tetapi
   * material itu sendiri tetap ada — riwayat referensi tidak boleh hilang.
   */
  async remove(id: string): Promise<boolean> {
    try {
      const result = await this.db.query('DELETE FROM courses WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      throw new DatabaseError(
        `Gagal menghapus mata kuliah: ${(error as Error).message}`,
      );
    }
  }
}

export class SemesterRepository {
  constructor(private readonly db: Db) {}

  /** Jalankan SELECT dan kembalikan baris bertipe. */
  private async select<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult = await this.db.query(text, params);
    return result.rows as unknown as T[];
  }

  private static mapRow(row: SemesterRow): Semester {
    return {
      id: row.id,
      term: row.term as Semester['term'],
      year: row.year,
      label: row.label,
    };
  }

  async findAll(): Promise<Semester[]> {
    try {
      const rows = await this.select<SemesterRow>(
        'SELECT * FROM semesters ORDER BY year DESC, term ASC',
      );
      return rows.map(SemesterRepository.mapRow);
    } catch (error) {
      throw new DatabaseError(
        `Gagal membaca daftar semester: ${(error as Error).message}`,
      );
    }
  }

  async findById(id: string): Promise<Semester | null> {
    const rows = await this.select<SemesterRow>('SELECT * FROM semesters WHERE id = $1', [id]);
    const row = rows[0];
    return row ? SemesterRepository.mapRow(row) : null;
  }

  async findExistingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const rows = await this.select<{ id: string }>(
      `SELECT id FROM semesters WHERE id IN (${placeholders})`,
      ids,
    );
    return new Set(rows.map((row) => row.id));
  }

  async insert(semester: Omit<Semester, 'id'> & { id: string }): Promise<Semester> {
    try {
      await this.db.query(
        'INSERT INTO semesters (id, term, year, label) VALUES ($1, $2, $3, $4)',
        [semester.id, semester.term, semester.year, semester.label],
      );
    } catch (error) {
      throw new DatabaseError(
        `Gagal menyimpan semester: ${(error as Error).message}`,
      );
    }
    return (await this.findById(semester.id)) as Semester;
  }
}
