/**
 * CLI untuk menjalankan migrasi manual: `npm run migrate`.
 */
import { createDatabase, applyMigrations } from './connection.js';

async function runCli() {
  const db = createDatabase();
  try {
    await applyMigrations(db);
    console.log('Migrasi database PostgreSQL berhasil dijalankan.');
  } catch (err) {
    console.error('Gagal menjalankan migrasi:', err);
    process.exit(1);
  } finally {
    await db.end?.();
    process.exit(0);
  }
}

runCli();