/**
 * Helper transaksi: menjalankan fn dalam BEGIN/COMMIT pada satu koneansi.
 *
 * pg.Pool meminjamkan client khusus agar BEGIN..COMMIT tidak tersebar ke
 * koneansi lain; PGlite (test) adalah koneansi tunggal sehingga BEGIN/COMMIT
 * tetap konsisten tanpa pinjaman client.
 */
import type { Db, DbClient } from './connection.js';

export async function withTransaction<T>(
  db: Db,
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = db.connect ? await db.connect() : db;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Rollback gagal — lempar error asli supaya penyebab terlihat.
    }
    throw error;
  } finally {
    client.release?.();
  }
}
