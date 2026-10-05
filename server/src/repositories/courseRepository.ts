/**
 * Repository course & semester: akses data murni untuk tabel `courses` dan
 * `semesters`. Tidak ada validasi bisnis (mis. duplikasi kode dicek di service).
 */
import type { Db } from '../db/connection';
import type { Course, Semester } from '../../../shared/types';
import { DatabaseError } from '../utils/errors';

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

export class CourseRepository {
  constructor(private readonly db: Db) {}

  private static mapRow(row: CourseRow): Course {
    return {
      id: row.id,
      semesterId: row.semester_id,
      code: row.code,
      name: row.name,
      lecturer: row.lecturer,
      credits: row.credits,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findAll(): Course[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM courses ORDER BY code ASC')
        .all() as CourseRow[];
      return rows.map(CourseRepository.mapRow);
    } catch (error) {
      throw new DatabaseError(`Gagal membaca daftar mata kuliah: ${(error as Error).message}`);
    }
  }

  findById(id: string): Course | null {
    const row = this.db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as
      | CourseRow
      | undefined;
    return row ? CourseRepository.mapRow(row) : null;
  }

  findByCode(code: string): Course | null {
    const row = this.db
      .prepare('SELECT * FROM courses WHERE code = ?')
      .get(code.toUpperCase()) as CourseRow | undefined;
    return row ? CourseRepository.mapRow(row) : null;
  }

  /** Kembalikan ID course yang valid saja — dipakai service sebelum insert relasi. */
  findExistingIds(ids: string[]): Set<string> {
    if (ids.length === 0) return new Set();
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id FROM courses WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  insert(course: CourseRowInput & { id: string }): Course {
    try {
      this.db
        .prepare(
          `INSERT INTO courses (id, semester_id, code, name, lecturer, credits, color,
                                created_at, updated_at)
           VALUES (@id, @semesterId, @code, @name, @lecturer, @credits, @color,
                   datetime('now'), datetime('now'))`,
        )
        .run(course);
    } catch (error) {
      throw new DatabaseError(`Gagal menyimpan mata kuliah: ${(error as Error).message}`);
    }
    return this.findById(course.id) as Course;
  }

  update(id: string, patch: CourseUpdateInput): Course | null {
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

    const setClause = entries.map(([field]) => `${columnByField[field]} = @${field}`).join(', ');

    try {
      const result = this.db
        .prepare(
          `UPDATE courses SET ${setClause}, updated_at = datetime('now') WHERE id = @id`,
        )
        .run({ ...patch, id });
      if (result.changes === 0) return null;
    } catch (error) {
      throw new DatabaseError(`Gagal memperbarui mata kuliah: ${(error as Error).message}`);
    }
    return this.findById(id);
  }

  /**
   * Hapus mata kuliah. Relasi di material_courses dihapus (CASCADE), tetapi
   * material itu sendiri tetap ada — riwayat referensi tidak boleh hilang.
   */
  remove(id: string): boolean {
    try {
      return this.db.prepare('DELETE FROM courses WHERE id = ?').run(id).changes > 0;
    } catch (error) {
      throw new DatabaseError(`Gagal menghapus mata kuliah: ${(error as Error).message}`);
    }
  }
}

export class SemesterRepository {
  constructor(private readonly db: Db) {}

  private static mapRow(row: SemesterRow): Semester {
    return {
      id: row.id,
      term: row.term as Semester['term'],
      year: row.year,
      label: row.label,
    };
  }

  findAll(): Semester[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM semesters ORDER BY year DESC, term ASC')
        .all() as SemesterRow[];
      return rows.map(SemesterRepository.mapRow);
    } catch (error) {
      throw new DatabaseError(`Gagal membaca daftar semester: ${(error as Error).message}`);
    }
  }

  findById(id: string): Semester | null {
    const row = this.db.prepare('SELECT * FROM semesters WHERE id = ?').get(id) as
      | SemesterRow
      | undefined;
    return row ? SemesterRepository.mapRow(row) : null;
  }

  findExistingIds(ids: string[]): Set<string> {
    if (ids.length === 0) return new Set();
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id FROM semesters WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  insert(semester: Omit<Semester, 'id'> & { id: string }): Semester {
    try {
      this.db
        .prepare('INSERT INTO semesters (id, term, year, label) VALUES (@id, @term, @year, @label)')
        .run(semester);
    } catch (error) {
      throw new DatabaseError(`Gagal menyimpan semester: ${(error as Error).message}`);
    }
    return this.findById(semester.id) as Semester;
  }
}
