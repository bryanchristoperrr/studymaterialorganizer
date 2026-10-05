/**
 * Entry point server untuk Vercel Serverless & Local Development.
 */
import { createApp } from './app';
import { createDatabase, applyMigrations } from './db/connection';

// Inisialisasi database dan aplikasi Express
const db = createDatabase();

// Jalankan migrasi database saat start
applyMigrations(db).catch((err) => {
  console.error('Gagal menjalankan migrasi database saat startup:', err);
});

const { app } = createApp(db);

// Ekspor app agar Vercel Serverless dapat menangkap request HTTP
export default app;

// Jika dijalankan secara lokal (bukan di Vercel), jalankan HTTP listener biasa
if (process.env.NODE_ENV !== 'production') {
  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => {
    console.log(`API Study Material Organizer berjalan di http://localhost:${PORT}`);
  });
}