/**
 * Entry point server (local development & host VM).
 * Menjalankan migrasi skema lalu menyalakan HTTP listener.
 * Di Vercel, entry point-nya adalah api/index.ts (serverless).
 */
import { existsSync } from 'node:fs';
import { createApp, DIST_PATH } from './app.js';
import { applyMigrations, createDatabase } from './db/connection.js';

const PORT = Number(process.env.PORT ?? 3001);

const db = createDatabase();
// Skema dibuat/dimutakhirkan sebelum listener aktif.
await applyMigrations(db);

const { app } = createApp(db);

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- log startup.
  console.log(`API Study Material Organizer berjalan di http://localhost:${PORT}`);
  // eslint-disable-next-line no-console -- log startup.
  console.log('Database: PostgreSQL (DATABASE_URL)');
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
