/**
 * Entry point server (local development & host VM).
 * Menjalankan migrasi skema lalu menyalakan HTTP listener.
 * Di Vercel, entry point-nya adalah api/index.ts (serverless).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, DIST_PATH } from './app.js';
import { applyMigrations, createDatabase } from './db/connection.js';
import { createLocalDatabase } from './db/local.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Muat server/.env bila ada (pengganti dotenv, tanpa dependensi
 * tambahan). Nilai tidak menimpa environment variable yang
 * sudah ada sehingga config sistem/CI tetap prioritas.
 */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match?.[1] || match[2] === undefined) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = value;
    }
  }
}

loadEnvFile(resolve(__dirname, '../.env'));

const PORT = Number(process.env.PORT ?? 3001);

// Produksi: pg.Pool ke DATABASE_URL (Supabase).
// Dev tanpa DATABASE_URL: PGlite lokal yang persisten
// (PostgreSQL asli, data di server/data/pglite).
const useLocal = !process.env.DATABASE_URL;
const db = useLocal ? await createLocalDatabase() : createDatabase();

// Skema dibuat/dimutakhirkan sebelum listener aktif.
await applyMigrations(db);

const { app } = createApp(db);

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- log startup.
  console.log(`API Study Material Organizer berjalan di http://localhost:${PORT}`);
  // eslint-disable-next-line no-console -- log startup.
  console.log(
    useLocal
      ? 'Database: PGlite lokal (server/data/pglite) — set DATABASE_URL untuk PostgreSQL/Supabase'
      : 'Database: PostgreSQL (DATABASE_URL)',
  );
  // eslint-disable-next-line no-console -- log startup.
  console.log(
    existsSync(DIST_PATH)
      ? `Frontend (build) disajikan di http://localhost:${PORT}`
      : 'Frontend belum dibangun. Jalankan "npm run build" terlebih dahulu, atau "npm run dev" untuk mode development.',
  );
});

/** Tutup server & database dengan rapi saat proses dihentikan (Ctrl+C). */
function shutdown(signal: string): void {
  // eslint-disable-next-line no-console -- log shutdown.
  console.log(`\nMenerima ${signal}, menutup server...`);
  server.close(() => {
    void db.end?.();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
