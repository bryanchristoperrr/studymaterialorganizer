/**
 * Entry point server tunggal untuk Vercel Serverless & Local Development.
 */

import express from 'express';
import cors from 'cors';
import { createDatabase, applyMigrations } from './db/connection.js';

// Inisialisasi database dan migrasi PostgreSQL
const db = createDatabase();
applyMigrations(db).catch((err) => {
  console.error('Gagal menjalankan migrasi database saat startup:', err);
});

// Buat aplikasi Express
const app = express();

app.use(cors());
app.use(express.json());

// Rute dasar untuk pengecekan kesehatan server / tes koneksi
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ekspor app agar Vercel Serverless dapat menangkap request HTTP
export default app;

// Jika dijalankan secara lokal (bukan di Vercel), jalankan HTTP listener biasa
if (process.env.NODE_ENV !== 'production') {
  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => {
    console.log(`API berjalan di http://localhost:${PORT}`);
  });
}