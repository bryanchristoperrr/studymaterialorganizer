/**
 * Repository tag: daftar tag beserta jumlah material yang memakainya.
 * Tag dibuat otomatis oleh service ketika pengguna mengetik tag baru (B9).
 */
import type { Db } from '../db/connection';
import type { Tag } from '../../../shared/types';
import { DatabaseError } from '../utils/errors';

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  material_count: number;
}

export class TagRepository {
  constructor(private readonly db: Db) {}

  private static mapRow(row: TagRow): Tag {
    return { id: row.id, name: row.name, color: row.color, materialCount: row.material_count };
  }

  findAll(): Tag[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT t.id, t.name, t.color,
                  (SELECT COUNT(*) FROM material_tags mt WHERE mt.tag_id = t.id) AS material_count
           FROM tags t
           ORDER BY t.name ASC`,
        )
        .all() as TagRow[];
      return rows.map(TagRepository.mapRow);
    } catch (error) {
      throw new DatabaseError(`Gagal membaca daftar tag: ${(error as Error).message}`);
    }
  }

  findByName(name: string): Tag | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as
      | { id: string; name: string; color: string | null }
      | undefined;
    return row ? { id: row.id, name: row.name, color: row.color, materialCount: 0 } : null;
  }

  /** Dipakai test & service untuk membersihkan data antar-kasus uji. */
  findExistingIds(ids: string[]): Set<string> {
    if (ids.length === 0) return new Set();
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id FROM tags WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  insert(tag: { id: string; name: string; color?: string | null }): Tag {
    try {
      this.db
        .prepare('INSERT INTO tags (id, name, color) VALUES (@id, @name, @color)')
        .run({ color: null, ...tag });
    } catch (error) {
      throw new DatabaseError(`Gagal menyimpan tag: ${(error as Error).message}`);
    }
    return { id: tag.id, name: tag.name, color: tag.color ?? null, materialCount: 0 };
  }
}
