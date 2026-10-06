# Architecture

## Scope

Dokumen ini mencakup **Fase M1 (CRUD inti)** dari spesifikasi `SPEC.md`:

- `materials` — referensi arsip (link, ringkasan, metadata dasar)
- `courses` + `semesters` — mata kuliah dan periodenya
- `tags` — tema lintas mata kuliah
- Pencarian (LIKE), filter majemuk, pagination, soft delete, validasi ganda

Fitur fase berikutnya (FTS5, link health check, dedupe similarity, attachment, spaced
repetition, backup/import) **tidak** ada di kode saat ini; rancangnya di `SPEC.md`.

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite via `better-sqlite3` (file-based, zero-config)
- **API Communication**: RESTful JSON over HTTP
- **Styling**: CSS Modules (or plain CSS)
- **Validation**: Zod (skema di `server/shared/`, dipakai frontend & backend)
- **Testing**: Vitest + React Testing Library + supertest

## Running the Application

| Command | Keterangan |
|---------|-----------|
| `npm run dev` | Vite dev server (port 5173), proxy `/api` → 3001 |
| `npm run dev:api` | Server Express saja (mode watch) |
| `npm start` | Build frontend, lalu serve API + frontend di port 3001 |
| `npm run build` | Typecheck + produksi build ke `dist/` |
| `npm test` | Vitest (frontend) |
| `npm --prefix server test` | Vitest (server) |

**Satu server untuk production**: `server/src/app.ts` menyajikan `dist/`
melalui `express.static` (MIME type benar: `application/javascript`,
`text/css`, …) dengan SPA fallback ke `index.html` untuk route React
Router. Ini menghindari error *"Expected a JavaScript-or-Wasm module
script ... MIME type application/octet-stream"* yang terjadi bila
`dist/` disajikan oleh server statis yang tidak mengenal ekstensi
`.js`/`.tsx`, atau bila `index.html` dibuka langsung via `file://`
(module script diblokir dari `file://`).

Jangan pernah membuka `index.html` langsung dari filesystem — selalu
lewat `npm run dev` atau `npm start`.

## Repository Layout

```
/
├── src/                    # Frontend
│   ├── components/
│   │   ├── common/         # Button, Input, Select, Textarea, Modal, Badge, dll
│   │   ├── material/       # Komponen domain material
│   │   └── layout/         # AppLayout, AppHeader
│   ├── pages/              # Halaman (route-level)
│   ├── services/           # Lapisan komunikasi API
│   ├── hooks/              # State server & logika reusable
│   ├── types/              # Re-export tipe dari server/shared/ + tipe UI
│   ├── utils/              # Helper murni
│   ├── styles/
│   └── App.tsx             # Routing
├── server/
│   ├── shared/             # Skema Zod + tipe yang dipakai frontend & backend
│   │   ├── types.ts
│   │   └── schemas.ts
│   ├── src/
│   │   ├── controllers/    # HTTP request → service
│   │   ├── services/       # Logika bisnis
│   │   ├── repositories/   # Akses data (SQL)
│   │   ├── routes/         # Definisi route
│   │   ├── middleware/     # validation, asyncHandler, errorHandler, notFound
│   │   ├── db/             # koneksi + migrasi
│   │   ├── utils/          # normalisasi URL/DOI, pagination, error domain
│   │   ├── app.ts
│   │   └── index.ts
│   ├── api/                # Entry serverless Vercel
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── package.json            # Frontend + scripts proxy ke server
├── vite.config.ts
└── vitest.config.ts
```

> Path alias `shared/*` daftarkan di `tsconfig.json` (frontend →
> `server/shared/*`) dan `server/tsconfig.json` (→ `shared/*`).
> Folder `shared/` berada di dalam `server/` sehingga proyek
> backend Vercel (Root Directory = `server/`) self-contained:
> setiap file yang diimpor berada di dalam root proyek.

## Data Model

### Entity

```typescript
interface Material {
  id: string;                        // UUID
  type: MaterialType;                // 'pdf' | 'web' | 'drive' | 'video' | 'book' | 'dataset' | 'slide' | 'other'
  title: string;                     // Required, 3–200 chars
  url: string | null;                // Wajib kecuali type === 'book'
  doi: string | null;                // Ternormalisasi: '10.xxxx/yyy'
  sourceName: string | null;         // Nama jurnal / situs, max 200
  authors: string | null;            // 'Andi; Budi; Citra', max 2000
  publishedYear: number | null;      // 1500..tahun berjalan + 1
  publisher: string | null;          // max 200
  volume: string | null;             // max 20
  issue: string | null;              // max 20
  pages: string | null;              // max 40
  language: 'id' | 'en' | 'other' | null;
  summary: string | null;            // Ringkasan singkat, max 2000
  importance: 1 | 2 | 3 | 4 | 5;     // Default: 2
  status: 'active' | 'archived' | 'dead' | 'duplicate' | 'reading';
  deadlineAt: string | null;         // ISO datetime
  version: number;                   // Optimistic concurrency, naik tiap update
  deletedAt: string | null;          // Soft delete (Recycle Bin)
  createdAt: string;                 // ISO datetime
  updatedAt: string;                 // ISO datetime
}

interface Course {
  id: string;
  semesterId: string | null;
  code: string;                      // 'IF401', unik
  name: string;                      // max 120
  lecturer: string | null;           // max 120
  credits: number | null;            // 0..12
  color: string | null;              // hex
  createdAt: string;
  updatedAt: string;
}

interface Semester {
  id: string;
  term: 'ganjil' | 'genap';
  year: number;                      // 2000..2100
  label: string;                     // '2024/2025 Ganjil'
}

interface Tag {
  id: string;
  name: string;                      // lowercase, max 40, unik
  color: string | null;
}
```

### Database Schema (SQLite)

```sql
CREATE TABLE semesters (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL CHECK (term IN ('ganjil','genap')),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  label TEXT NOT NULL,
  UNIQUE (term, year)
);

CREATE TABLE courses (
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

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pdf','web','drive','video','book','dataset','slide','other')),
  title TEXT NOT NULL,
  url TEXT,
  doi TEXT,
  source_name TEXT,
  authors TEXT,
  published_year INTEGER CHECK (published_year BETWEEN 1500 AND 2200),
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

CREATE TABLE material_courses (
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'supporting' CHECK (role IN ('primary','supporting')),
  PRIMARY KEY (material_id, course_id)
);

CREATE TABLE material_tags (
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
  PRIMARY KEY (material_id, tag_id)
);

CREATE INDEX idx_materials_status   ON materials(status, deleted_at);
CREATE INDEX idx_materials_updated  ON materials(updated_at DESC);
CREATE INDEX idx_materials_doi      ON materials(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_materials_url      ON materials(url) WHERE url IS NOT NULL;
CREATE INDEX idx_mcourses_semester  ON courses(semester_id);
CREATE INDEX idx_matcourses_course  ON material_courses(course_id);
CREATE INDEX idx_material_tags_tag  ON material_tags(tag_id);
```

Kolom waktu disimpan sebagai TEXT ISO-8601 (UTC) agar konsisten antara SQLite, JSON, dan TypeScript.

## Business Rules (M1)

| ID | Aturan | Ditegakkan di |
|----|--------|---------------|
| B1 | `type='book'` boleh tanpa `url`; tipe lain wajib `url` valid | schema (superRefine) + service |
| B2 | URL dinormalisasi: host lowercase, param `utm_*` dibuang, trailing slash dibuang | `server/src/utils/normalize.ts` |
| B3 | Host `drive.google.com` → `type` jadi `drive` bila pengguna tidak memilih tipe | service |
| B4 | DOI dinormalisasi: buang prefix `https://doi.org/`, lowercase | `server/src/utils/normalize.ts` |
| B5 | `publishedYear` ≤ tahun berjalan + 1 | schema + service |
| B6 | DOI atau URL ternormalisasi yang sama → `409 DUPLICATE_MATERIAL` | service |
| B7 | Delete = soft delete (`deleted_at`), restore & purge eksplisit | service |
| B8 | Update wajib menyertakan `version`; tidak cocok → `409 VERSION_CONFLICT` | service |
| B9 | `tagNames` di-create otomatis (auto-create) bila belum ada | service |
| B10 | Nama course uppercase-trim, kode unik (case-insensitive) | service |
| B11 | `sort` dipetakan lewat allowlist; tidak ada input mentah ke SQL | repository |

## API Layer

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/materials` | List + filter + sort + paginate |
| GET | `/api/materials/:id` | Detail (dengan courses & tags) |
| POST | `/api/materials` | Create |
| PATCH | `/api/materials/:id` | Update partial (wajib `version`) |
| DELETE | `/api/materials/:id` | Soft delete → Recycle Bin |
| POST | `/api/materials/:id/restore` | Restore dari Recycle Bin |
| DELETE | `/api/materials/:id/purge` | Hapus permanen |
| GET | `/api/materials/filters` | Opsi filter (courses, tags, semesters) untuk form filter |
| GET | `/api/courses` | List mata kuliah |
| POST | `/api/courses` | Create mata kuliah |
| PATCH | `/api/courses/:id` | Update mata kuliah |
| DELETE | `/api/courses/:id` | Hapus mata kuliah (materials tetap ada, relasi dilepas) |
| GET | `/api/semesters` | List semester |
| POST | `/api/semesters` | Create semester (label di-generate bila kosong) |
| GET | `/api/tags` | List tag + jumlah material |
| GET | `/api/health` | Health check |

### Query `GET /api/materials`

```
?search=          — dicocokkan ke title, summary, source_name, authors
&type=pdf,drive   — multi-select
&courseId=        — berulang atau koma
&semesterId=
&tagId=
&status=active,dead
&importanceMin=3
&sort=updatedAt|createdAt|title|importance|deadline|status
&order=asc|desc
&page=1&limit=25   — limit maks 100
&includeDeleted=false
```

Semua query string divalidasi dengan Zod (`materialsQuerySchema`) sebelum masuk repository,
sehingga controller tidak pernah melempar error tak terduga karena input.

### Response Format

**Sukses**
```json
{ "data": { "id": "m_1", "title": "...", "version": 1 } }
```
**List**
```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 25, "total": 42, "totalPages": 2 }
}
```
**Error**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [{ "field": "title", "message": "Wajib diisi" }]
  }
}
```

## CRUD Flow

### Create Material
1. User mengisi `MaterialForm` (validasi Zod client-side, feedback inline per field)
2. Deteksi duplikat: form memanggil `duplicate-check` bila field DOI/URL terisi (M3; saat ini duplikat dicek server saat create)
3. `POST /api/materials`
4. `validate` middleware mem-parse body dengan `createMaterialSchema`
5. `materialService.create` → normalisasi URL/DOI, cek duplikat, resolve courses & tags
6. `materialRepository.insert` (+ insert relasi dalam transaksi)
7. Controller memetakan `ConflictError` → 409, `ValidationError` → 400
8. Frontend invalidate list, tampilkan toast sukses, navigasi ke detail

### Read List
1. `MaterialListPage` membaca filter dari URL query params
2. `useMaterials` (service layer) memanggil `GET /api/materials`
3. Repository membangun SQL dari filter tervalidasi + parameter binding
4. Return `{ data, pagination }`
5. Komponen merender list/loading/empty/error + Pagination

### Read Detail
1. Klik baris → route `/materials/:id`
2. `useMaterial(id)` memanggil `GET /api/materials/:id`
3. Render metadata, link, courses, tags, versi

### Update Material
1. Form edit dimuat dari detail (mengisi `version` saat ini)
2. `PATCH /api/materials/:id` dengan `{ ...fields, version }`
3. Service mengecek keberadaan, compares `version` (mismatch → 409), applies whitelist fields, naikkan `version`
4. Return material terbaru

### Delete Material
1. ConfirmModal menyebut judul material
2. `DELETE /api/materials/:id` → `deleted_at` diisi
3. List di-refresh; material pindah ke Recycle Bin

## Component Responsibilities

### UI Components (`src/components/`)
- **MaterialList**: merender `MaterialCard` per item, handle empty/loading/error
- **MaterialCard**: ringkasan (judul, badge tipe, status, importance, courses, tanggal update)
- **MaterialForm**: form create/edit; validasi dengan skema shared, normalisasi error server ke field
- **MaterialFilters**: semester, mata kuliah, tipe, status, tag, importance min
- **MaterialSearch**: input cari dengan debounce 300 ms
- **ConfirmModal**: konfirmasi generik (title, description, confirmLabel, onConfirm)

### Pages (`src/pages/`)
- **MaterialListPage**: state filter/paginasi dari URL, fetch list, render filter + search + list
- **MaterialCreatePage**: `MaterialForm` mode create
- **MaterialEditPage**: fetch material, `MaterialForm` mode edit
- **MaterialDetailPage**: fetch + render metadata, aksi edit/delete/restore
- **CoursesPage**: CRUD mata kuliah & semester

### Services (`src/services/`)
- **apiClient.ts**: wrapper `fetch` → parse JSON, throw `ApiError` typed (status, code, fieldErrors)
- **materialService.ts**: semua panggilan `/api/materials`
- **courseService.ts**: `/api/courses`, `/api/semesters`, `/api/tags`
- Setiap fungsi meneruskan `AbortSignal` agar request lama dibatalkan saat filter berubah

### Hooks (`src/hooks/`)
- **useMaterials(filters)**: data, loading, error, pagination; fetch ulang saat filter berubah
- **useMaterial(id)**: detail satu material
- **useCourses()**: options filter (dipakai form & filter)
- **useDebouncedValue(value, delay)**: menunda input pencarian
- Tidak ada global state untuk data server (lihat `CONSTRAINTS.md`)

## Layer Responsibilities

### Repository (`server/src/repositories/`)
- Akses data murni: SQL, parameter binding, map row → entity
- Tidak ada validasi bisnis
- Melempar `DatabaseError` bila query gagal

### Service (`server/src/services/`)
- Logika bisnis: normalisasi, aturan B1–B10, transformasi
- Memanggil repository, melempar domain error (`NotFoundError`, `ValidationError`, `ConflictError`, `VersionConflictError`)

### Controller (`server/src/controllers/`)
- Menangaikan HTTP: baca req, panggil service, map domain error → status + payload
- Tidak ada logika bisnis

### Middleware
- **validate(schema)**: parse `body`/`query` dengan Zod, gagal → 400 `VALIDATION_ERROR`
- **errorHandler**: catch-all; log dengan `requestId`, balas pesan generik untuk 500
- **notFoundHandler**: route tidak dikenal → 404

## Validation Flow

### Client
1. Skema shared (`server/shared/schemas.ts`) mendefinisikan bentuk form
2. `MaterialForm` memvalidasi per-field saat blur/submit
3. Submit memvalidasi seluruh form sebelum request
4. Error 400 dari server dipetakan ke field terkait bila `details[].field` cocok

### Server
1. `validate()` middleware mem-parse dengan skema yang sama
2. Service menerapkan aturan bisnis (normalisasi, duplikat, version, referensi course/tag)
3. Constraint database (UNIQUE `courses.code`, `tags.name`, CHECK) sebagai penjaga terakhir
4. Error selalu berbentuk envelope seragam

## Error Handling Flow

1. **Repository** → `DatabaseError`
2. **Service** → `NotFoundError` / `ValidationError` / `ConflictError` / `VersionConflictError`
3. **Controller** → mapping ke HTTP
4. **Middleware** → `errorHandler` untuk sisanya (termasuk SyntaxError JSON → 400)
5. **Frontend `apiClient`** → `ApiError` dengan `status`, `code`, `fieldErrors`
6. **Komponen** → pesan ramah; 500 tidak pernah menampilkan detail internal

## Testing Strategy

| Level | Tool | Cakupan |
|-------|------|---------|
| Unit | Vitest | `normalize.ts` (URL/DOI), `pagination`, query builder |
| Service (integration) | Vitest + SQLite in-memory **nyata** | aturan bisnis B1–B10, cascade soft delete |
| API | supertest | kontrak endpoint & status code |
| Component | React Testing Library | form validation, empty/error state |

Constraint: integration test memakai SQLite sungguhan (tidak mock), dan test tidak pernah di-skip.
