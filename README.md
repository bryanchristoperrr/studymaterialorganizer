# Study Material Organizer

Aplikasi perpustakaan pribadi untuk mengumpulkan referensi skripsi dan tugas akhir:
tautan (Google Drive, PDF, web), nama jurnal, mata kuliah terkait, dan ringkasan singkat.

Dibangun dengan **React 18 + TypeScript + Vite** (frontend), **Node.js + Express +
TypeScript** (backend), dan **SQLite** (penyimpanan lokal, tanpa server database terpisah).

## Fitur (Fase M1 — CRUD inti)

- **Simpan referensi**: judul, tipe sumber (pdf / web / Google Drive / video / buku /
  dataset / slide), URL, DOI, nama jurnal, penulis, tahun terbit, publisher,
  volume/issue/halaman, bahasa, ringkasan, tingkat kepentingan (1–5), deadline.
- **Normalisasi otomatis**: URL (host lowercase, parameter tracking `utm_*`/`gclid`
  dibuang) dan DOI (`10.xxxx/yyy`) dinormalisasi sebelum disimpan.
- **Deteksi duplikat**: DOI atau URL yang sama ditolak dengan `409` + petunjuk
  material yang sudah ada; endpoint `duplicate-check` untuk peringatan dini di form.
- **Organisasi**: mata kuliah (dengan semester, kode, SKS), tag otomatis, filter
  majemuk (tipe, status, mata kuliah, semester, tag, importance minimum).
- **Pencarian** pada judul, ringkasan, sumber, dan penulis; paginasi server-side;
  filter tersimpan di URL (bisa di-bookmark).
- **Soft delete → Recycle Bin → restore / purge permanen** (tidak ada data hilang
  tidak sengaja).
- **Optimistic concurrency**: setiap update membawa `version`; tab lain yang lebih
  dulu menyimpan menghasilkan `409 VERSION_CONFLICT` (mencegah lost update).
- **Validasi ganda** dengan satu skema Zod yang dipakai frontend dan backend.

## Requirement

- **Node.js ≥ 22** (satu runtime untuk frontend dan backend)
- npm ≥ 10
- `better-sqlite3` menyertakan prebuilt binary untuk Windows / Linux / macOS;
  di platform lain mungkin perlu toolchain build (Python + C++ compiler).

## Instalasi & Menjalankan

```bash
# instal dependensi (frontend + server)
npm install
npm --prefix server install

# development (kedua proses sekaligus, satu terminal)
npm run dev:all

# atau manual di dua terminal terpisah:
npm run dev       # Vite (port 5173), proxy /api → 3001
npm run dev:api   # Express (port 3001)

# production: build frontend, lalu serve API + frontend di port 3001
npm start
```

Buka **http://localhost:3001** (production) atau **http://localhost:5173** (development).

> Jangan buka `index.html` langsung dari filesystem — module script diblokir dari
> `file://` dan server statis tanpa MIME type yang benar akan menolak aset `.js`.

Database SQLite dibuat otomatis di `server/data/app.db` saat server pertama kali
dijalankan (folder `data/` diabaikan git).

## Pengujian

```bash
npm test                    # frontend (Vitest + React Testing Library)
npm --prefix server test    # backend (Vitest + supertest, SQLite in-memory nyata)
```

68 test mencakup unit (normalisasi URL/DOI), integrasi service (aturan bisnis
dengan database sungguhan, bukan mock), dan kontrak API (status code + envelope error).

## Struktur Proyek

```
├── shared/            # Tipe + skema Zod pakai bersama frontend & backend
├── src/               # Frontend React
│   ├── components/    # common/ (Button, Modal, …) + material/ (domain)
│   ├── pages/         # Daftar, Detail, Tambah, Edit, Courses
│   ├── services/      # Lapisan API (komponen tidak pernah fetch langsung)
│   └── hooks/         # useMaterials, useAsyncData, useDebouncedValue
├── server/
│   └── src/
│       ├── repositories/  # Akses data (SQL, parameter binding)
│       ├── services/      # Logika bisnis (aturan B1–B10)
│       ├── controllers/   # HTTP → service
│       ├── middleware/    # Validasi Zod, error handler
│       └── db/            # Koneksi + migrasi otomatis
└── dist/              # Hasil build (dibuat oleh npm run build)
```

Arsitektur berlapis: `UI → Service → Controller → Service → Repository → Database`.
Detail aturan bisnis (B1–B10), model data, dan kontrak API ada di
[`ARCHITECTURE.md`](ARCHITECTURE.md); rancangan fitur lanjutan (FTS5, link health
check, attachment, spaced repetition, backup) ada di [`SPEC.md`](SPEC.md).

## API (ringkas)

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/materials` | List + filter + sort + paginate |
| POST | `/api/materials` | Buat materi |
| GET / PATCH / DELETE | `/api/materials/:id` | Detail / update (wajib `version`) / soft delete |
| POST | `/api/materials/:id/restore` | Restore dari Recycle Bin |
| DELETE | `/api/materials/:id/purge` | Hapus permanen |
| POST | `/api/materials/duplicate-check` | Cek kandidat duplikat |
| GET / POST | `/api/courses`, `/api/semesters` | CRUD mata kuliah & semester |
| GET | `/api/tags` | Daftar tag + jumlah pemakaian |

Respons error seragam: `{ "error": { "code", "message", "details"? } }`.

## Keamanan & Batasan

- Aplikasi **lokal-first, single-user**: belum ada autentikasi. **Jangan host di
  server publik** sebelum fitur autentasi (fase M5) ditambahkan — API akan
  dapat diakses siapa saja.
- Semua query memakai parameter binding (tidak ada string interpolation SQL).
- Nama file attachment (fase mendatang) disimpan acak untuk mencegah path traversal.

## Roadmap

| Fase | Isi |
|------|-----|
| **M1** ✅ | CRUD inti, filter, pencarian, soft delete, dedupe dasar |
| **M2** | Full-text search (FTS5), saved search, koleksi (folder), bulk action, ekspor sitasi (BibTeX/RIS) |
| **M3** | Deteksi duplikat cerdas (similarity), link health check terjadwal + arsip Wayback |
| **M4** | Catatan append-only, revision history, attachment file, spaced repetition, tenggat |
| **M5** | Impor/ekspor (CSV/Zotero), backup/restore, audit log, autentasi |

## Lisensi

[MIT](LICENSE) © 2026 Study Material Organizer contributors

## Kontribusi

Issues dan pull request welcome. Ikuti aturan arsitektur di `AGENTS.md` dan
`CONSTRAINTS.md` (lapisan terpisah, validasi ganda, tanpa mock database di
integration test).
