/**
 * Test kontrak API memakai supertest terhadap app Express + SQLite in-memory.
 * Fokus: status code, bentuk response, dan pemetaan domain error → HTTP.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app.js';
import { createTestContext } from './helpers.js';

let ctx: AppContext;

const validMaterial = {
  type: 'pdf',
  title: 'Bahan Ujian Midterm',
  url: 'https://example.com/midterm.pdf',
  tagNames: ['ujian'],
};

beforeEach(async () => {
  ctx = await createTestContext();
});

describe('GET /api/health', () => {
  it('menjawab status ok', async () => {
    const response = await request(ctx.app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });
});

describe('POST /api/materials', () => {
  it('membuat material dan mengembalikan 201', async () => {
    const response = await request(ctx.app).post('/api/materials').send(validMaterial);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ title: validMaterial.title, version: 1 });
  });

  it('menolak payload tidak valid dengan 400 + detail per field', async () => {
    const response = await request(ctx.app)
      .post('/api/materials')
      .send({ type: 'pdf', title: 'a' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'title' })]),
    );
  });

  it('menolak JSON tidak valid dengan 400 INVALID_JSON', async () => {
    const response = await request(ctx.app)
      .post('/api/materials')
      .set('Content-Type', 'application/json')
      .send('{ tidak valid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('menolak URL duplikat dengan 409 DUPLICATE_MATERIAL', async () => {
    await request(ctx.app).post('/api/materials').send(validMaterial);
    const response = await request(ctx.app)
      .post('/api/materials')
      .send({ ...validMaterial, title: 'Materi Kembar' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_MATERIAL');
  });
});

describe('GET /api/materials', () => {
  it('mengembalikan data + pagination', async () => {
    await request(ctx.app).post('/api/materials').send(validMaterial);

    const response = await request(ctx.app).get('/api/materials').query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 10, total: 1 });
  });

  it('menolak parameter query tidak valid', async () => {
    const response = await request(ctx.app).get('/api/materials').query({ sort: 'DROP TABLE' });
    expect(response.status).toBe(400);
  });

  it('menolak limit di atas batas maksimum', async () => {
    const response = await request(ctx.app).get('/api/materials').query({ limit: 500 });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/materials/:id', () => {
  it('mengembalikan detail beserta relasi course & tag', async () => {
    const course = await request(ctx.app)
      .post('/api/courses')
      .send({ code: 'IF401', name: 'Kecerdasan Artifisial' });
    const courseId = course.body.data.id as string;

    const created = await request(ctx.app)
      .post('/api/materials')
      .send({ ...validMaterial, courseIds: [courseId] });

    const response = await request(ctx.app).get(`/api/materials/${created.body.data.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.courseIds).toEqual([courseId]);
    expect(response.body.data.tagNames).toEqual(['ujian']);
  });

  it('mengembalikan 404 untuk id yang tidak ada', async () => {
    const response = await request(ctx.app).get('/api/materials/m_tidak_ada');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/materials/:id', () => {
  it('memperbarui material dan menaikkan version', async () => {
    const created = await request(ctx.app).post('/api/materials').send(validMaterial);

    const response = await request(ctx.app)
      .patch(`/api/materials/${created.body.data.id}`)
      .send({ summary: 'Ringkasan terbaru', version: 1 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ summary: 'Ringkasan terbaru', version: 2 });
  });

  it('mengembalikan 409 VERSION_CONFLICT untuk versi lama', async () => {
    const created = await request(ctx.app).post('/api/materials').send(validMaterial);
    const id = created.body.data.id as string;

    await request(ctx.app).patch(`/api/materials/${id}`).send({ summary: 'v2', version: 1 });
    const response = await request(ctx.app)
      .patch(`/api/materials/${id}`)
      .send({ summary: 'v3', version: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('menolak update tanpa version', async () => {
    const created = await request(ctx.app).post('/api/materials').send(validMaterial);
    const response = await request(ctx.app)
      .patch(`/api/materials/${created.body.data.id}`)
      .send({ summary: 'tanpa version' });

    expect(response.status).toBe(400);
  });
});

describe('DELETE & restore /api/materials/:id', () => {
  it('soft delete lalu restore', async () => {
    const created = await request(ctx.app).post('/api/materials').send(validMaterial);
    const id = created.body.data.id as string;

    const deleted = await request(ctx.app).delete(`/api/materials/${id}`);
    expect(deleted.status).toBe(204);

    const listAfterDelete = await request(ctx.app).get('/api/materials');
    expect(listAfterDelete.body.data).toHaveLength(0);

    const restored = await request(ctx.app).post(`/api/materials/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeNull();
  });

  it('purge menghapus material secara permanen', async () => {
    const created = await request(ctx.app).post('/api/materials').send(validMaterial);
    const id = created.body.data.id as string;

    await request(ctx.app).delete(`/api/materials/${id}`);
    const purged = await request(ctx.app).delete(`/api/materials/${id}/purge`);
    expect(purged.status).toBe(204);

    const response = await request(ctx.app).get(`/api/materials/${id}`);
    expect(response.status).toBe(404);
  });
});

describe('POST /api/materials/duplicate-check', () => {
  it('menandai kandidat duplikat berdasarkan URL ternormalisasi', async () => {
    await request(ctx.app).post('/api/materials').send(validMaterial);

    const response = await request(ctx.app)
      .post('/api/materials/duplicate-check')
      .send({ url: 'https://example.com/midterm.pdf?utm_source=wa' });

    expect(response.status).toBe(200);
    expect(response.body.data.hasDuplicate).toBe(true);
    expect(response.body.data.duplicate.title).toBe(validMaterial.title);
  });

  it('menolak body tanpa DOI maupun URL', async () => {
    const response = await request(ctx.app).post('/api/materials/duplicate-check').send({});
    expect(response.status).toBe(400);
  });
});

describe('Courses, semesters, tags', () => {
  it('membaca daftar course dan menolak kode duplikat', async () => {
    const created = await request(ctx.app)
      .post('/api/courses')
      .send({ code: 'if402', name: 'Basis Data' });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('IF402');

    const duplicate = await request(ctx.app)
      .post('/api/courses')
      .send({ code: 'IF402', name: 'Basis Data Lanjut' });
    expect(duplicate.status).toBe(409);

    const list = await request(ctx.app).get('/api/courses');
    expect(list.body.data).toHaveLength(1);
  });

  it('membuat dan membaca semester', async () => {
    const created = await request(ctx.app)
      .post('/api/semesters')
      .send({ term: 'ganjil', year: 2025 });
    expect(created.status).toBe(201);

    const list = await request(ctx.app).get('/api/semesters');
    expect(list.body.data[0].label).toBe('2025 Ganjil');
  });

  it('mengembalikan tag beserta jumlah material', async () => {
    await request(ctx.app).post('/api/materials').send(validMaterial);

    const response = await request(ctx.app).get('/api/tags');
    expect(response.body.data).toEqual([
      expect.objectContaining({ name: 'ujian', materialCount: 1 }),
    ]);
  });
});

describe('route tidak dikenal', () => {
  it('mengembalikan 404 dengan envelope error', async () => {
    const response = await request(ctx.app).get('/api/tidak-ada');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
