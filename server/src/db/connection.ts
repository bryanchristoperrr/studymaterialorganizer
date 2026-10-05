/**
 * Koneksi PostgreSQL (Supabase) untuk lingkungan produksi (Vercel).
 * Test memakai PGlite (PostgreSQL in-memory) — lihat tests/helpers.ts.
 *
 * Repository tidak pernah mengimpor pg secara langsung: semua akses
 * melewati antarmuka `Db` sehingga database bisa dipertukarkan
 * (pg.Pool di produksi, PGlite di test) tanpa mengubah repository.
 */
import pkg from 'pg';
const { Pool } = pkg;
import { migrations } from './migrations.js';

/** Bentuk hasil query yang dipakai repository (pg.Pool memenuhinya). */
export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}

/** Satu koneksi database. `release` dipanggil setelah transaksi selesai. */
export interface DbClient {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
  release?(): void;
}

/** Handle database: pool (produksi) atau koneksi tunggal (test). */
export interface Db extends DbClient {
  /** Ambil koneksi khusus untuk transaksi. Tidak ada → pakai Db langsung. */
  connect?(): Promise<DbClient>;
  end?(): Promise<void>;
}

let pool: pkg.Pool | null = null;

/**
 * Koneksi pool ke Supabase/PostgreSQL dari DATABASE_URL.
 * Dipanggil sekali per proses; pemanggil berikutnya mendapat pool yang sama.
 */
export function createDatabase(): Db {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined.');
    }
    pool = new Pool({
      connectionString,
      // Supabase mewajibkan SSL; sertifikat root-nya tidak divalidasi manual.
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

/** Jalankan migrasi skema secara idempoten (tabel & indeks IF NOT EXISTS). */
export async function applyMigrations(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const res = await db.query('SELECT name FROM _migrations');
  const applied = new Set(res.rows.map((row) => String(row.name)));

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    // PGlite (dan prepared statement pg umumnya) menolak beberapa
    // perintah dalam satu query — eksekusi per pernyataan.
    // Aman karena skema tidak memakai literal ';' di dalam SQL.
    const statements = migration.sql
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    for (const statement of statements) {
      await db.query(statement);
    }
    await db.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
  }
}
