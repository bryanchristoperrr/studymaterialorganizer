/**
 * Test integrasi service layer memakai PGlite (PostgreSQL in-memory
 * sungguhan). Setiap kasus memakai context baru agar data tidak
 * saling memengaruhi.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createMaterialSchema, updateMaterialSchema } from '../shared/schemas.js';
import type { MaterialsQuery } from '../shared/schemas.js';
import type { AppContext } from '../src/app.js';
import { ConflictError, NotFoundError, ValidationError } from '../src/utils/errors.js';
import { createTestContext } from './helpers.js';

let ctx: AppContext;

/** Skema create diparse di sini agar test memakai validasi yang sama dengan HTTP. */
function parseCreate(payload: Record<string, unknown>) {
  const result = createMaterialSchema.safeParse(payload);
  if (!result.success) throw new Error(`Payload tidak valid: ${result.error.message}`);
  return result.data;
}

function parseUpdate(payload: Record<string, unknown>) {
  const result = updateMaterialSchema.safeParse(payload);
  if (!result.success) throw new Error(`Payload tidak valid: ${result.error.message}`);
  return result.data;
}

beforeEach(async () => {
  ctx = await createTestContext();
});

describe('MaterialService.create', () => {
  it('menyimpan material beserta relasi course dan tag (B9)', async () => {
    const course = await ctx.courseService.createCourse({ code: 'IF401', name: 'Kecerdasan Artifisial' });

    const material = await ctx.materialService.create(
      parseCreate({
        type: 'pdf',
        title: 'Bab 3 Skripsi',
        url: 'https://example.com/bab3.pdf',
        courseIds: [course.id],
        tagNames: ['Skripsi', 'statistika'],
      }),
    );

    expect(material.version).toBe(1);
    expect(material.status).toBe('active');
    expect(material.importance).toBe(2);

    const detail = await ctx.materialService.getById(material.id);
    expect(detail.courseIds).toEqual([course.id]);
    // Tag dinormalisasi ke lowercase.
    expect(detail.tagNames).toEqual(['skripsi', 'statistika']);
  });

  it('menormalisasi URL dan DOI sebelum menyimpan (B2, B4)', async () => {
    const material = await ctx.materialService.create(
      parseCreate({
        type: 'web',
        title: 'Artikel Uji Autentik',
        url: 'HTTPS://Example.com/artikel/?utm_source=zoom',
        doi: 'https://doi.org/10.1000/ABC',
      }),
    );

    expect(material.url).toBe('https://example.com/artikel');
    expect(material.doi).toBe('10.1000/abc');
  });

  it('menolak URL wajib untuk tipe selain book (B1, ditegakkan service)', async () => {
    // Sengaja memanggil service tanpa melewati skema, untuk membuktikan aturan
    // business tetap ditegakkan meski dipanggil dari luar HTTP.
    await expect(
      ctx.materialService.create({ type: 'pdf', title: 'Tanpa URL' } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('mengizinkan book tanpa URL (B1)', async () => {
    const material = await ctx.materialService.create(
      parseCreate({ type: 'book', title: 'Buku Statistika Modern' }),
    );
    expect(material.url).toBeNull();
  });

  it('menolak DOI duplikat (B6)', async () => {
    await ctx.materialService.create(
      parseCreate({ type: 'web', title: 'Artikel Satu', url: 'https://a.example/1', doi: '10.1000/x' }),
    );

    await expect(
      ctx.materialService.create(
        parseCreate({ type: 'web', title: 'Artikel Kembar', url: 'https://a.example/2', doi: '10.1000/x' }),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('menolak URL duplikat setelah normalisasi (B2 + B6)', async () => {
    await ctx.materialService.create(
      parseCreate({ type: 'web', title: 'Sumber A', url: 'https://a.example/artikel?utm_source=x' }),
    );

    await expect(
      ctx.materialService.create(
        parseCreate({ type: 'web', title: 'Sumber B', url: 'https://a.example/artikel' }),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('menolak courseId yang tidak dikenal', async () => {
    await expect(
      ctx.materialService.create(
        parseCreate({
          type: 'pdf',
          title: 'Materi Tanpa Course',
          url: 'https://a.example/x',
          courseIds: ['c_tidak_ada'],
        }),
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe('MaterialService.update', () => {
  it('menaikkan version pada setiap update (B8)', async () => {
    const created = await ctx.materialService.create(
      parseCreate({ type: 'pdf', title: 'Judul Lama', url: 'https://a.example/1' }),
    );

    const updated = await ctx.materialService.update(
      created.id,
      parseUpdate({ title: 'Judul Baru', version: created.version }),
    );

    expect(updated.title).toBe('Judul Baru');
    expect(updated.version).toBe(2);
  });

  it('menolak update dengan version lama (B8)', async () => {
    const created = await ctx.materialService.create(
      parseCreate({ type: 'pdf', title: 'Judul Asli', url: 'https://a.example/1' }),
    );

    await ctx.materialService.update(created.id, parseUpdate({ title: 'Judul Baru', version: 1 }));

    await expect(
      ctx.materialService.update(created.id, parseUpdate({ title: 'Judul Lain', version: 1 })),
    ).rejects.toThrow(ConflictError);
  });

  it('PATCH sebagian tidak menghapus relasi course/tag yang tidak dikirim', async () => {
    const course = await ctx.courseService.createCourse({ code: 'IF402', name: 'Basis Data' });
    const created = await ctx.materialService.create(
      parseCreate({
        type: 'pdf',
        title: 'Materi Terhubung',
        url: 'https://a.example/2',
        courseIds: [course.id],
        tagNames: ['db'],
      }),
    );

    const updated = await ctx.materialService.update(
      created.id,
      parseUpdate({ summary: 'Ringkasan baru', version: created.version }),
    );

    const detail = await ctx.materialService.getById(updated.id);
    expect(detail.courseIds).toEqual([course.id]);
    expect(detail.tagNames).toEqual(['db']);
  });

  it('PATCH sebagian tidak mengubah field yang tidak dikirim (termasuk tipe)', async () => {
    const created = await ctx.materialService.create(
      parseCreate({
        type: 'pdf',
        title: 'Tipe Tetap',
        url: 'https://drive.google.com/file/d/abc/view',
      }),
    );
    // URL ber-host Google Drive, tetapi tipe tidak boleh berubah saat update.
    expect(created.type).toBe('pdf');

    const updated = await ctx.materialService.update(
      created.id,
      parseUpdate({ summary: 'Ringkasan baru', version: created.version }),
    );

    expect(updated.type).toBe('pdf');
    expect(updated.summary).toBe('Ringkasan baru');
  });

  it('menolak update material yang tidak ada', async () => {
    await expect(
      ctx.materialService.update('m_hilang', parseUpdate({ title: 'X Y Z', version: 1 })),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('MaterialService delete family (B7)', () => {
  it('soft delete menyembunyikan material dari list lalu bisa di-restore', async () => {
    const created = await ctx.materialService.create(
      parseCreate({ type: 'pdf', title: 'Akan Dihapus', url: 'https://a.example/3' }),
    );

    await ctx.materialService.softDelete(created.id);

    const list = await ctx.materialService.list({
      sort: 'updatedAt',
      order: 'desc',
      page: 1,
      limit: 25,
      includeDeleted: false,
    } as never);
    expect(list.items).toHaveLength(0);

    const trash = await ctx.materialService.list({
      sort: 'updatedAt',
      order: 'desc',
      page: 1,
      limit: 25,
      includeDeleted: true,
    } as never);
    expect(trash.items).toHaveLength(1);

    const restored = await ctx.materialService.restore(created.id);
    expect(restored.deletedAt).toBeNull();
  });

  it('purge menghapus material beserta relasinya', async () => {
    const course = await ctx.courseService.createCourse({ code: 'IF403', name: 'Jaringan' });
    const created = await ctx.materialService.create(
      parseCreate({
        type: 'web',
        title: 'Dihapus Permanen',
        url: 'https://a.example/4',
        courseIds: [course.id],
        tagNames: ['jaringan'],
      }),
    );

    await ctx.materialService.softDelete(created.id);
    await ctx.materialService.purge(created.id);

    await expect(ctx.materialService.getById(created.id)).rejects.toThrow(NotFoundError);
    // Tag masih ada sebagai master data, namun tidak terikat material mana pun.
    expect((await ctx.tagService.list()).map((tag) => tag.name)).toContain('jaringan');
    expect(
      (await ctx.tagService.list()).find((tag) => tag.name === 'jaringan')?.materialCount,
    ).toBe(0);
  });

  it('restore material yang tidak ada di recycle bin ditolak', async () => {
    const created = await ctx.materialService.create(
      parseCreate({ type: 'pdf', title: 'Masih Aktif', url: 'https://a.example/5' }),
    );
    await expect(ctx.materialService.restore(created.id)).rejects.toThrow(ConflictError);
  });
});

describe('MaterialService.list', () => {
  const query = {
    sort: 'updatedAt',
    order: 'desc',
    page: 1,
    limit: 25,
    includeDeleted: false,
  } satisfies MaterialsQuery;

  it('mencari pada judul, ringkasan, dan penulis', async () => {
    await ctx.materialService.create(
      parseCreate({
        type: 'web',
        title: 'Artikel Contoh',
        url: 'https://a.example/6',
        authors: 'Siti; Rina',
        summary: 'Tentang regresi',
      }),
    );
    await ctx.materialService.create(
      parseCreate({
        type: 'web',
        title: 'Judul Lain',
        url: 'https://a.example/7',
        authors: 'Budi',
        summary: 'Tentang regresi juga',
      }),
    );

    expect(
      (await ctx.materialService.list({ ...(query as MaterialsQuery), search: 'regresi' })).items,
    ).toHaveLength(2);
    expect(
      (await ctx.materialService.list({ ...(query as MaterialsQuery), search: 'Siti' })).items.map(
        (m) => m.title,
      ),
    ).toEqual(['Artikel Contoh']);
  });

  it('memfilter berdasarkan tipe, status, dan importance minimum', async () => {
    await ctx.materialService.create(
      parseCreate({ type: 'pdf', title: 'Penting Sekali', url: 'https://a.example/8', importance: 5 }),
    );
    await ctx.materialService.create(
      parseCreate({ type: 'video', title: 'Video Materi', url: 'https://a.example/9' }),
    );

    const result = await ctx.materialService.list({
      ...(query as MaterialsQuery),
      type: ['pdf'],
      importanceMin: 4,
    });
    expect(result.items.map((m) => m.title)).toEqual(['Penting Sekali']);
  });

  it('membatasi hasil per halaman dan mengirim total', async () => {
    for (let index = 0; index < 5; index += 1) {
      await ctx.materialService.create(
        parseCreate({ type: 'web', title: `Materi ${index}`, url: `https://a.example/${index}` }),
      );
    }

    const result = await ctx.materialService.list({ ...(query as MaterialsQuery), page: 2, limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.pagination).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });
});

describe('CourseService', () => {
  it('menyimpan kode course dalam huruf besar (B10)', async () => {
    const course = await ctx.courseService.createCourse({ code: 'if401', name: 'Kecerdasan Artifisial' });
    expect(course.code).toBe('IF401');
  });

  it('menolak kode course yang sudah dipakai', async () => {
    await ctx.courseService.createCourse({ code: 'IF401', name: 'Kecerdasan Artifisial' });
    await expect(
      ctx.courseService.createCourse({ code: 'IF401', name: 'Kecerdasan Artifisial Lanjut' }),
    ).rejects.toThrow(ConflictError);
  });

  it('menolak semesterId yang tidak dikenal', async () => {
    await expect(
      ctx.courseService.createCourse({ code: 'IF405', name: 'Kriptografi', semesterId: 's_x' }),
    ).rejects.toThrow(ValidationError);
  });

  it('membentuk label semester otomatis', async () => {
    const semester = await ctx.courseService.createSemester({ term: 'ganjil', year: 2024 });
    expect(semester.label).toBe('2024 Ganjil');
  });

  it('menolak semester duplikat', async () => {
    await ctx.courseService.createSemester({ term: 'genap', year: 2024 });
    await expect(ctx.courseService.createSemester({ term: 'genap', year: 2024 })).rejects.toThrow(
      ConflictError,
    );
  });

  it('menghapus course tanpa menghapus material yang merujuknya', async () => {
    const course = await ctx.courseService.createCourse({
      code: 'IF410',
      name: 'Pemrograman Berorientasi Objek',
    });
    const material = await ctx.materialService.create(
      parseCreate({
        type: 'slide',
        title: 'Slide OOP',
        url: 'https://a.example/slide',
        courseIds: [course.id],
      }),
    );

    await ctx.courseService.deleteCourse(course.id);

    const detail = await ctx.materialService.getById(material.id);
    expect(detail.id).toBe(material.id);
    expect(detail.courseIds).toEqual([]);
  });
});
