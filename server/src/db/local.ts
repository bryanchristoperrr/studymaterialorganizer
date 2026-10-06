/**
 * Database lokal untuk development: PGlite (PostgreSQL asli
 * berbasis WASM) dengan dataDir persisten di disk.
 *
 * Hanya dipakai oleh src/index.ts saat DATABASE_URL tidak
 * diset, sehingga dev lokal bisa jalan tanpa instalasi
 * PostgreSQL/Supabase. Produksi (Vercel) selalu memakai
 * DATABASE_URL → pg.Pool, sehingga modul ini tidak pernah
 * masuk bundle serverless (api/index.ts tidak mengimpornya).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { Db, QueryResult } from './connection.js';

/**
 * Membungkus PGlite ke antarmuka Db yang sama dengan pg.Pool
 * (rowCount ← affectedRows; satu koneansi untuk "transaksi").
 */
function toDb(pg: PGlite): Db {
  const run = async (text: string, params?: unknown[]): Promise<QueryResult> => {
    const result = await pg.query(text, params);
    return {
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.affectedRows ?? null,
    };
  };

  return {
    query: run,
    connect: async () => ({ query: run }),
    end: async () => {
      await pg.close();
    },
  };
}

/**
 * Koneksi PGlite yang tersimpan di server/data/pglite
 * (data bertahan antar-restart, diabaikan git).
 */
export async function createLocalDatabase(): Promise<Db> {
  const dataDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../data/pglite',
  );
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return toDb(new PGlite(dataDir));
}
