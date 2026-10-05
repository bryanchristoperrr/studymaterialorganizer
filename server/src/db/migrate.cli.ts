/**
 * CLI untuk menjalankan migrasi manual: `npm run migrate`.
 * Berguna bila ingin menyiapkan skema tanpa menyalakan server.
 */
import { createDatabase, DEFAULT_DB_PATH } from './connection';

const db = createDatabase(DEFAULT_DB_PATH);
db.close();

// eslint-disable-next-line no-console -- CLI memang harus mencetak hasil ke stdout.
console.log(`Migrasi selesai untuk database: ${DEFAULT_DB_PATH}`);
