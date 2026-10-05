import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Server tests berjalan di environment Node dan memakai SQLite in-memory
// (database sungguhan, bukan mock) — lihat CONSTRAINTS.md bagian Testing.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      shared: fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
});
