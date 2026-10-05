/**
 * Koneksi PostgreSQL (Supabase) untuk Vercel Serverless.
 */
import pkg from 'pg';
const { Pool } = pkg;
import { migrations } from './migrations.js';

export type Db = pkg.Pool;

let pool: pkg.Pool | null = null;

export function createDatabase(): Db {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined.');
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Diperlukan untuk koneksi ke Supabase di lingkungan serverless
      },
    });
  }

  return pool;
}

/** Jalankan migrasi ke PostgreSQL (idempoten). */
export async function applyMigrations(db: Db): Promise<void> {
  const client = await db.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const res = await client.query('SELECT name FROM _migrations');
    const applied = new Set(res.rows.map((row) => row.name));

    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      
      // Catatan: Jika ada sintaks SQL SQLite di migration.sql yang berbeda 
      // dengan PostgreSQL, pastikan untuk menyesuaikannya.
      await client.query(migration.sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
    }
  } finally {
    client.release();
  }
}