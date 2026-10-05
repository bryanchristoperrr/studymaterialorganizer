/**
 * Koneksi SQLite + provisioning skema.
 *
 * Database dibuka dengan flag WAL dan foreign_keys ON supaya cascade delete
 * (B7/B10) bekerja. Fungsi `createDatabase` menerima path file, sehingga test
 * integration dapat memakai ':memory:' tanpa mock.
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrations } from './migrations';

export type Db = Database.Database;

/**
 * Path default: <server>/data/app.db (diabaikan git).
 * Dihitung dari lokasi file ini, bukan process.cwd(), agar tidak
 * bergantung pada folder tempat server dijalankan.
 */
export const DEFAULT_DB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../data/app.db',
);

export function createDatabase(dbPath: string = DEFAULT_DB_PATH): Db {
  if (dbPath !== ':memory:') {
    const directory = dirname(dbPath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applyMigrations(db);
  return db;
}

/** Jalankan migrasi yang belum tercatat di tabel _migrations (idempoten). */
export function applyMigrations(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    db
      .prepare<[], { name: string }>('SELECT name FROM _migrations')
      .all()
      .map((row) => row.name),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    db.exec(migration.sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
  }
}
