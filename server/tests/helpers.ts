/**
 * Helper test: membangun aplikasi dengan PGlite (PostgreSQL in-memory
 * berbasis WASM — database sungguhan, bukan mock, lihat CONSTRAINTS.md).
 *
 * PGlite memenuhi antarmuka `Db` yang sama dengan pg.Pool (produksi),
 * sehingga repository & service diuji dengan dialek SQL yang identik
 * (parameter $1, ON CONFLICT, NOW(), ILIKE).
 */
import { PGlite } from '@electric-sql/pglite';
import { createApp, type AppContext } from '../src/app.js';
import { applyMigrations, type Db, type QueryResult } from '../src/db/connection.js';

/** Bungkus PGlite ke antarmuka Db (rowCount ← affectedRows). */
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
    // PGlite adalah satu koneansi: "client" tambahan tetap memakai
    // koneansi yang sama, sehingga BEGIN/COMMIT tetap konsisten.
    connect: async () => ({ query: run }),
    end: async () => {
      await pg.close();
    },
  };
}

/** Context test dengan database PostgreSQL segar (migrasi sudah dijalankan). */
export async function createTestContext(): Promise<AppContext> {
  const db = toDb(new PGlite());
  await applyMigrations(db);
  return createApp(db);
}

/** Data material minimal yang valid, bisa di-override per kasus uji. */
export function materialPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'pdf',
    title: 'Analisis Regresi Linier Berganda',
    url: 'https://example.com/regresi.pdf',
    summary: 'Bab 3 skripsi',
    importance: 4,
    courseIds: [] as string[],
    tagNames: ['statistika'],
    ...overrides,
  };
}
