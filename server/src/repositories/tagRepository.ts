/**
 * Repository tag: daftar tag beserta jumlah material yang memakainya.
 * Tag dibuat otomatis oleh service ketika pengguna mengetik tag baru (B9).
 *
 * Dialek PostgreSQL: parameter bernomor ($1, $2, …) dan ON CONFLICT.
 */
import type { Db, QueryResult } from '../db/connection.js';
import type { Tag } from '../../../shared/types.js';
import { DatabaseError } from '../utils/errors.js';

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  material_count: string | number;
}

export class TagRepository {
  constructor(private readonly db: Db) {}

  /** Jalankan SELECT dan kembalikan baris bertipe. */
  private async select<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult = await this.db.query(text, params);
    return result.rows as unknown as T[];
  }

  private static mapRow(row: TagRow): Tag {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      materialCount: Number(row.material_count),
    };
  }

  async findAll(): Promise<Tag[]> {
    try {
      const rows = await this.select<TagRow>(
        `SELECT t.id, t.name, t.color,
                (SELECT COUNT(*) FROM material_tags mt WHERE mt.tag_id = t.id) AS material_count
         FROM tags t
         ORDER BY t.name ASC`,
      );
      return rows.map(TagRepository.mapRow);
    } catch (error) {
      throw new DatabaseError(`Gagal membaca daftar tag: ${(error as Error).message}`);
    }
  }

  async findByName(name: string): Promise<Tag | null> {
    const rows = await this.select<{ id: string; name: string; color: string | null }>(
      'SELECT * FROM tags WHERE name = $1',
      [name],
    );
    const row = rows[0];
    return row ? { id: row.id, name: row.name, color: row.color, materialCount: 0 } : null;
  }

  /** Dipakai test & service untuk membersihkan data antar-kasus uji. */
  async findExistingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const rows = await this.select<{ id: string }>(
      `SELECT id FROM tags WHERE id IN (${placeholders})`,
      ids,
    );
    return new Set(rows.map((row) => row.id));
  }

  async insert(tag: { id: string; name: string; color?: string | null }): Promise<Tag> {
    try {
      await this.db.query(
        'INSERT INTO tags (id, name, color) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
        [tag.id, tag.name, tag.color ?? null],
      );
    } catch (error) {
      throw new DatabaseError(`Gagal menyimpan tag: ${(error as Error).message}`);
    }
    return { id: tag.id, name: tag.name, color: tag.color ?? null, materialCount: 0 };
  }
}
