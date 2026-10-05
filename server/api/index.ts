/**
 * Entry point serverless Vercel: fungsi ini melayani /api/*.
 *
 * Express `app` adalah handler (req, res) yang valid sehingga cukup
 * diekspor sebagai default export. Migrasi skema dijalankan sekali
 * saat cold start, sebelum fungsi menerima request pertama.
 */
import { createApp } from '../src/app.js';
import { applyMigrations, createDatabase } from '../src/db/connection.js';

const db = createDatabase();
const { app } = createApp(db);

// Skema dibuat/dimutakhirkan sebelum handler aktif (cold start).
await applyMigrations(db);

export default app;
