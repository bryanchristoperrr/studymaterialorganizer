/**
 * Helper test: membangun aplikasi dengan SQLite in-memory (database sungguhan,
 * bukan mock — lihat CONSTRAINTS.md bagian Testing).
 */
import { createApp, type AppContext } from '../src/app';
import { createDatabase, type Db } from '../src/db/connection';

export function createTestContext(): AppContext {
  const db: Db = createDatabase(':memory:');
  return createApp(db);
}

/** Data material minimal yang valid, bisa di-override per kasus uji. */
export function materialPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'pdf',
    title: 'Analisis Regresi Linier Berganda',
    url: 'https://example.com/regresi.pdf',
    summary: 'Bab 3 skripsi',
    importance: 4,
    courseIds: [] as string[],
    tagNames: ['statistika'],
    ...overrides,
  };
}
