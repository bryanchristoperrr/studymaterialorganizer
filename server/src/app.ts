/**
 * Composition root: merangkai repository → service → controller → route.
 * Database di-inject di sini supaya test dapat memakai SQLite in-memory
 * tanpa mengubah kode aplikasi sama sekali.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cors from 'cors';
import { createDatabase, applyMigrations } from './db/connection.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { CourseRepository, SemesterRepository } from './repositories/courseRepository';
import { MaterialRepository } from './repositories/materialRepository';
import { TagRepository } from './repositories/tagRepository';
import { createCourseRoutes, createSemesterRoutes, createTagRoutes } from './routes/courseRoutes';
import { createMaterialRoutes } from './routes/materialRoutes';
import { CourseService } from './services/courseService';
import { MaterialService } from './services/materialService';
import { TagService } from './services/tagService';

export interface AppContext {
  app: Express;
  db: Db;
  materialService: MaterialService;
  courseService: CourseService;
  tagService: TagService;
}

/**
 * Path hasil `vite build` (root/dist). Dihitung dari lokasi file ini
 * (server/src/app.ts → naik 2 level ke root proyek), bukan
 * process.cwd(), agar tidak bergantung pada folder tempat server dijalankan.
 */
export const DIST_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../dist',
);

export function createApp(db: Db = createDatabase()): AppContext {
  // --- Repository (akses data) ---
  const materialRepository = new MaterialRepository(db);
  const courseRepository = new CourseRepository(db);
  const semesterRepository = new SemesterRepository(db);
  const tagRepository = new TagRepository(db);

  // --- Service (logika bisnis) ---
  const materialService = new MaterialService(materialRepository, courseRepository, tagRepository);
  const courseService = new CourseService(courseRepository, semesterRepository);
  const tagService = new TagService(tagRepository);

  // --- HTTP ---
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ data: { status: 'ok' } });
  });

  app.use('/api/materials', createMaterialRoutes(materialService));
  app.use('/api/courses', createCourseRoutes(courseService));
  app.use('/api/semesters', createSemesterRoutes(courseService));
  app.use('/api/tags', createTagRoutes(tagService));

  // --- Frontend (hasil build) ---
  // express.static mengirim header Content-Type yang benar
  // (text/javascript, text/css, ...) sehingga browser mau menjalankan
  // module script — menghindari error "Expected a JavaScript-or-Wasm
  // module script ... MIME type application/octet-stream".
  if (existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));

    // SPA fallback: URL seperti /materials/:id dikirim ke index.html
    // agar React Router bisa menanganinya di sisi klien.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(resolve(DIST_PATH, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, db, materialService, courseService, tagService };
}
