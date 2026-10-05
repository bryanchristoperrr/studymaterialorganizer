/**
 * Entry point alternatif untuk host serverless lain (Railway, Render, dsb.).
 * Di Vercel, entry point aktif adalah api/index.ts (lihat vercel.json).
 */
export { default } from './api/index.js';
