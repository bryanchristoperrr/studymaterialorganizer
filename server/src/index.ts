/**
 * Entry point server. Menjalankan migrasi skema lalu menyalakan HTTP listener.
 */
import { existsSync } from 'node:fs';
import { createApp, DIST_PATH } from './app';
import { createDatabase, DEFAULT_DB_PATH } from './db/connection';

const PORT = Number(process.env.PORT ?? 3001);

const { app, db } = createApp(createDatabase(DEFAULT_DB_PATH));

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- log startup.
  console.log(`API Study Material Organizer berjalan di http://localhost:${PORT}`);
  // eslint-disable-next-line no-console -- log startup.
  console.log(`Database: ${DEFAULT_DB_PATH}`);
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
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
