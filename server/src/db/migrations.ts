/**
 * Migrasi skema database. Dijalankan otomatis saat server start
 * (lihat db/connection.ts) sehingga tidak perlu langkah manual.
 *
 * M1 hanya memuat tabel yang dipakai CRUD inti; tabel fase berikutnya
 * (notes, attachments, link_checks, ...) ditambahkan di migrasi terpisah.
 */
export const migrations: Array<{ name: string; sql: string }> = [
  {
    name: '001_initial',
    sql: `
      CREATE TABLE IF NOT EXISTS semesters (
        id TEXT PRIMARY KEY,
        term TEXT NOT NULL CHECK (term IN ('ganjil','genap')),
        year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
        label TEXT NOT NULL,
        UNIQUE (term, year)
      );

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        lecturer TEXT,
        credits INTEGER CHECK (credits BETWEEN 0 AND 12),
        color TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('pdf','web','drive','video','book','dataset','slide','other')),
        title TEXT NOT NULL,
        url TEXT,
        doi TEXT,
        source_name TEXT,
        authors TEXT,
        published_year INTEGER,
        publisher TEXT,
        volume TEXT,
        issue TEXT,
        pages TEXT,
        language TEXT CHECK (language IN ('id','en','other') OR language IS NULL),
        summary TEXT,
        importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 5),
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','archived','dead','duplicate','reading')),
        deadline_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS material_courses (
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        course_id   TEXT NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'supporting' CHECK (role IN ('primary','supporting')),
        PRIMARY KEY (material_id, course_id)
      );

      CREATE TABLE IF NOT EXISTS material_tags (
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        tag_id      TEXT NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
        PRIMARY KEY (material_id, tag_id)
      );

      CREATE INDEX IF NOT EXISTS idx_materials_status  ON materials(status, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_materials_updated ON materials(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_materials_doi     ON materials(doi) WHERE doi IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_materials_url     ON materials(url) WHERE url IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_courses_semester  ON courses(semester_id);
      CREATE INDEX IF NOT EXISTS mat_courses_course    ON material_courses(course_id);
      CREATE INDEX IF NOT EXISTS material_tags_tag     ON material_tags(tag_id);
    `,
  },
];
