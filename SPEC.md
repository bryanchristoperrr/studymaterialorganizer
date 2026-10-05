# Study Material Organizer — Spesifikasi Fungsional & Desain

Status: **M1 (CRUD inti) terimplementasi** — lihat `ARCHITECTURE.md` untuk detail teknis fase ini.
Stack: React 18 + TypeScript + Vite (frontend), Node.js + Express + TypeScript (backend), SQLite (penyimpanan), Zod (validasi), Vitest (testing)

---

## 1. Ringkasan Masalah

Perpustakaan pribadi untuk mengumpulkan referensi skripsi/tugas akhir. Nilai utamanya bukan pada
"menyimpan link" (yang bisa dilakukan bookmark), melainkan pada:

1. **Ditemukan kembali** saat butuh bahan ujian dalam 5 detik.
2. **Tetap layak dipercaya** seiring waktu — link Drive/PDF rusak atau berubah struktur.
3. **Bisa dikutip** dengan benar (jurnal, authors, DOI, tahun) tanpa mengetik ulang.
4. **Tidak hilang** — ada riwayat, arsip, dan backup.

Semua fitur di bawah diturunkan dari empat kebutuhan itu.

---

## 2. Celah pada Ide Awal & Penutupnya

| # | Celah pada ide awal | Risiko | Penutupan |
|---|---|---|---|
| 1 | "Menyimpan tautan" tanpa tipe sumber | Materi sampah bercampur (PDF vs slide vs video) | Field `type` tervalidasi (pdf/web/drive/video/book/dataset/slide) + ikon + filter |
| 2 | Link mati baru terasa saat diklik | Materi penting baru ketahuan rusak saat mepet ujian | **Link health check** terjadwal + arsip (Wayback) + riwayat status |
| 3 | Tidak ada strategi duplikat | Koleksi membusuk, materi yang sama tersimpan 3x | Deteksi duplikat by DOI / URL ternormalisasi / title similarity |
| 4 | Hanya filter semester & mata kuliah | Sulit dinavigasi saat data bertambah | Tag bertingkat + koleksi (folder) bersarang + saved search |
| 5 | "Cari berdasarkan kata kunci" vague | Pencarian title saja tidak menemukan isi | **SQLite FTS5 full-text** (title, ringkasan, catatan, authors) + highlight |
| 6 | Ringkasan singkat tunggal, tanpa jejak | Catatan penting ketimpa | Catatan bertanggal (append-only) + riwayat revisi (revision history) |
| 7 | Metadata jurnal minim | Sitasi manual, rawan salah | Authors, DOI, year, publisher, volume/issue/pages + ekspor BibTeX/CSL-JSON/CSV |
| 8 | Delete langsung | Kehilangan tidak sengaja, tidak bisa undo | **Soft delete → Recycle Bin → restore/purge** + konfirmasi dengan nama item |
| 9 | Tabrakan edit dari 2 tab | Data tertimpa diam-diam | Optimistic concurrency (`version` column → 409 Conflict) |
| 10 | Tidak ada akun/privasi | Database lokal, tapi tetap perlu proteksi dasar | Single-user lokal + PIN/session sederhana + backup/ekspor |
| 11 | Lampiran file_pdf tidak pernah disinggung | Penyimpanan membengkak tanpa batas | Tabel `attachments`, batas ukuran, checksum untuk dedupe |
| 12 | "Ujian" disebut tapi tidak ada fitur | Nilai tool tidak terasa | Tenggat (`deadlineAt`) + status belajar spaced repetition sederhana |
| 13 | Data masuk manual saja | Migrasi dari Zotero/RIOS lama mahal | Impor CSV/RIS + ekspor backup JSON (round-trip safe) |
| 14 | Skala data tak terbatas | Lambat di >500 item | Pagination server-side + index + virtualized list |
| 15 | Error handling kurang dalam | "Gagal memuat" tanpa jalan keluar | Error envelope konsisten + toast + retry + empty states |
| 16 | Tidak ada jejak siapa ubah apa | Sulit debug | Audit log (aksi, entitas, waktu) untuk perubahan destruktif |

---

## 3. Model Data

### 3.1 Diagram Relasi (ringkas)

```
Semester 1─* Course 1─* MaterialCourse *─1 Material *─* Tag
                            │                        │  ├─1 Note (append-only)
                            │                        │  ├─* LinkCheck
                            │                        │  ├─* Attachment
                            │                        │  └─1 ReviewState
                            └─* CollectionMaterial *─1 Collection (self-nested)
Material 1─* ActivityLog
```

> Sitasi tidak punya tabel sendiri: metadata jurnal sudah ada di `materials`, dan ekspor
> BibTeX/CSL/RIS dihasilkan on-demand dari kolom tersebut.

### 3.2 Tabel

**semester**
```sql
CREATE TABLE semesters (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL CHECK (term IN ('ganjil','genap')),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  label TEXT NOT NULL,              -- "2024/2025 Ganjil" (display)
  UNIQUE (term, year)
);
```

**courses** (mata kuliah)
```sql
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,        -- "IF401"
  name TEXT NOT NULL,               -- max 120
  lecturer TEXT,                    -- max 120
  credits INTEGER CHECK (credits BETWEEN 0 AND 12),
  color TEXT,                       -- hex, untuk badge di UI
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**materials** (inti: satu referensi arsip)
```sql
CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pdf','web','drive','video','book','dataset','slide','other')),
  title TEXT NOT NULL,                        -- max 200, wajib
  url TEXT,                                   -- wajib kecuali type='book'
  doi TEXT,                                   -- opsional, normalisasi lowercase
  source_name TEXT,                           -- nama jurnal / situs / publisher
  authors TEXT,                               -- "Andi; Budi; Citra" (disimpan sebagai teks, dipecah saat ekspor)
  published_year INTEGER CHECK (published_year BETWEEN 1500 AND 2200),
  publisher TEXT,
  volume TEXT, issue TEXT, pages TEXT,
  language TEXT CHECK (language IN ('id','en','other') OR language IS NULL),
  summary TEXT,                               -- ringkasan singkat, max 2000
  importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 5),  -- 1 unimportant..5 critical
  status TEXT NOT NULL DEFAULT 'active'
         CHECK (status IN ('active','archived','dead','duplicate','reading')),
  deadline_at DATETIME,                       -- tenggat ujian/review materi ini
  version INTEGER NOT NULL DEFAULT 1,         -- optimistic concurrency
  deleted_at DATETIME,                        -- soft delete (recycle bin)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

> Catatan desain: `materials` sengaja **tidak** punya `course_id` tunggal — satu referensi bisa dipakai
> di beberapa mata kuliah (mis. modul Statistika dipakai IF401 & IF402). Relasi many-to-many di `material_courses`.

**material_courses** (relasi + peran)
```sql
CREATE TABLE material_courses (
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'supporting' CHECK (role IN ('primary','supporting')),
  PRIMARY KEY (material_id, course_id)
);
```

**tags** & **material_tags** (tema, untuk item lintas mata kuliah)
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,      -- lowercase, max 40
  color TEXT
);
CREATE TABLE material_tags (
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
  PRIMARY KEY (material_id, tag_id)
);
```

**collections** (folder bersarang + saved search)
```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES collections(id) ON DELETE CASCADE,  -- NULL = root
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),  -- max 80
  description TEXT,
  -- bila search_query terisi, collection = "saved search", bukan folder
  search_query TEXT,               -- JSON query filter
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE collection_materials (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  material_id   TEXT NOT NULL REFERENCES materials(id)   ON DELETE CASCADE,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, material_id)
);
```

**notes** (append-only, tidak menimpa riwayat)
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),  -- max 5000
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','insight','todo','quote')),
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**attachments** (file lokal, bukan URL)
```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,          -- nama tampilan
  stored_name TEXT NOT NULL UNIQUE,-- nama acak di disk, mencegah path traversal
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  checksum TEXT,                   -- sha256, untuk dedupe
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**link_checks** (riwayat kesehatan tautan)
```sql
CREATE TABLE link_checks (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  http_status INTEGER,             -- null = gagal koneksi/DNS
  is_alive INTEGER NOT NULL,
  latency_ms INTEGER,
  final_url TEXT,                  -- setelah redirect, untuk deteksi link berubah
  error_code TEXT,                 -- 'timeout','dns','403','404','paywall','unknown'
  suggested_archive_url TEXT       -- fallback Wayback
);
CREATE INDEX idx_link_checks_material ON link_checks(material_id, checked_at DESC);
```

**review_states** (spaced repetition sederhana)
```sql
CREATE TABLE review_states (
  material_id TEXT PRIMARY KEY REFERENCES materials(id) ON DELETE CASCADE,
  mastery INTEGER NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 5),
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at DATETIME,
  next_review_at DATETIME
);
```

**activity_logs** (audit trail)
```sql
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('create','update','delete','restore','purge','check','import')),
  before_json TEXT,                 -- hanya untuk action='update' (diff per-field)
  after_json  TEXT,
  summary     TEXT,                -- deskripsi singkat, tanpa data sensitif
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id, created_at DESC);
```

**Index pendukung query utama**
```sql
CREATE INDEX idx_materials_status   ON materials(status, deleted_at);
CREATE INDEX idx_materials_updated  ON materials(updated_at DESC);
CREATE INDEX idx_materials_deadline ON materials(deadline_at) WHERE deadline_at IS NOT NULL;
CREATE INDEX idx_materials_doi      ON materials(doi)  WHERE doi  IS NOT NULL;
CREATE INDEX idx_materials_url      ON materials(url)  WHERE url  IS NOT NULL;
CREATE INDEX idx_mcourses_semester  ON courses(semester_id);
CREATE INDEX idx_matcourses_course  ON material_courses(course_id);
CREATE INDEX idx_material_tags_tag  ON material_tags(tag_id);
CREATE INDEX idx_notes_material     ON notes(material_id, created_at DESC);
```

### 3.3 Full-Text Search

```sql
CREATE VIRTUAL TABLE materials_fts USING fts5(
  title, summary, source_name, authors,
  content='',                      -- contentless: hemat ruang, tidak duplikasi data
  tokenize='unicode61 remove_diacritics 2'
);
-- Trigger: sinkronkan dari materials saat INSERT/UPDATE/DELETE
```
Full-text dipakai untuk **materi**; `notes` di-search via `LIKE` sederhana (catatan pendek, jumlah kecil).

> **Revision history** tidak memakai tabel terpisah: `activity_logs` menyimpan `before`/`after`
> JSON (diff per-field) untuk aksi `update`, sehingga riwayat perubahan tiap material bisa
> ditelusuri ulang tanpa duplikasi data. Field `before`/`after` tidak disimpan untuk aksi non-`update`.

---

## 4. Aturan Bisnis (Domain Rules)

| ID | Aturan |
|---|---|
| B1 | `type='book'` boleh tanpa `url`; tipe lain wajib `url` yang valid. |
| B2 | URL dinormalisasi sebelum disimpan: lowercase host, hapus parameter `utm_*`, hapus trailing slash, IDN dipunycode. |
| B3 | Host `drive.google.com` → `type` otomatis `drive` bila pengguna tidak memilih; dokumen publik diberi catatan hak akses. |
| B4 | DOI dinormalisasi ke bentuk `10.xxxx/...` (buang `https://doi.org/`, lowercase). |
| B5 | `published_year` tidak boleh lebih dari tahun berjalan + 1. |
| B6 | Duplikat: `doi` sama ATAU `url` ternormalisasi sama → `409 DUPLICATE_MATERIAL` dengan ID material yang sudah ada. |
| B7 | Soft delete: `deleted_at` diisi, item hilang dari list normal, muncul di Recycle Bin. Purge permanen hanya lewat purge eksplisit. |
| B8 | Update dengan `version` yang tidak cocok → `409 VERSION_CONFLICT` (mencegah lost update dari tab lain). |
| B9 | `dead` status tidak di-set otomatis oleh pengguna; di-set sistem saat link check gagal 2x berturut-turut, dan **tidak** otomatis saat 1x (transient error). |
| B10 | Purge material menghapus note, tag link, attachment, dan FTS row-nya (cascade). |
| B11 | Nama course/tag lowercase-trim saat create; duplikat ditolak dengan pesan jelas. |
| B12 | `deadline_at` yang lewat tidak otomatis menandai status; hanya ditampilkan badge "lewat". |
| B13 | Mastery naik hanya lewat endpoint review, tidak boleh di-set langsung dari form materi. |

---

## 5. API Surface

Base: `/api`. Semua response sukses: `{ "data": ..., "pagination"?: {...} }`.
Semua error: `{ "error": { "code", "message", "details"?: [{field, message}] } }`.

### 5.1 Materials
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/materials` | List + filter + sort + paginate |
| GET | `/api/materials/:id` | Detail (termasuk notes, tags, courses, collections) |
| POST | `/api/materials` | Create |
| PATCH | `/api/materials/:id` | Update partial; body wajib `version` |
| DELETE | `/api/materials/:id` | Soft delete → Recycle Bin |
| POST | `/api/materials/:id/restore` | Restore dari recycle bin |
| DELETE | `/api/materials/:id/purge` | Hapus permanen |
| POST | `/api/materials/bulk` | Aksi massal: `{ ids, action: 'archive'|'delete'|'tag' }` |
| POST | `/api/materials/duplicate-check` | `{ doi?, url?, title? }` → kandidat duplikat |
| GET | `/api/materials/:id/export` | Ekspor sitasi (format query: `bibtex\|csl-json\|ris\|markdown`) |

**Query `GET /api/materials`**
```
?search=          — full-text (FTS5) + fallback LIKE
&type=pdf,drive   — multi-select
&courseId=        — bisa berulang / koma
&semesterId=
&tagId=
&collectionId=
&status=active,dead
&importanceMin=3
&deadlineBefore=2026-01-31T00:00:00Z
&sort=updatedAt|relevance|importance|deadline|title
&order=asc|desc
&page=1&limit=25
&includeDeleted=false
```

### 5.2 Sub-resources
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | `/api/courses`, `GET/PATCH/DELETE /api/courses/:id` | CRUD mata kuliah |
| GET | `/api/semesters`, `POST /api/semesters` | Periode |
| GET | `/api/tags` | List + count (`auto-create` bila `POST /api/tags`) |
| GET/POST/PATCH/DELETE | `/api/collections[/:id]` | Folder bersarang & saved search |
| GET/POST | `/api/materials/:id/notes` | `GET` urut kronologis, `POST` append |
| PATCH/DELETE | `/api/notes/:id` | Edit/hapus satu catatan |
| POST | `/api/materials/:id/attachments` | Upload (multipart, maks 25 MB/materi) |
| GET | `/api/attachments/:id` | Unduh |
| DELETE | `/api/attachments/:id` | Hapus file + row |
| POST | `/api/materials/:id/link-check` | Cek manual (1 item) |
| POST | `/api/link-checks/batch` | Cek terjadwal/manuel banyak item |
| GET | `/api/materials/:id/link-checks` | Riwayat kesehatan tautan |
| POST | `/api/materials/:id/review` | `Recall/Forgot` → hitung mastery & next_review_at |
| GET/POST | `/api/activity-logs` | Audit log |
| POST | `/api/import` | Impor CSV/RIS |
| GET | `/api/export/backup` | Backup JSON lengkap (round-trip) |
| POST | `/api/restore/backup` | Restore dari backup JSON |
| GET | `/api/stats` | Dashboard: total per tipe/status, item mati, deadline terdekat |

### 5.3 Contoh Kontrak

**Create material**
```http
POST /api/materials
{
  "type": "pdf",
  "title": "Analisis Regresi Linier Berganda",
  "url": "https://drive.google.com/file/d/abc123/view",
  "courseIds": ["c1"],
  "tagNames": ["statistika", "skripsi"],
  "summary": "Bab 3 skripsi, berisi uji asumsi klasik.",
  "importance": 4,
  "doi": "10.1000/xyz123"
}
```
```json
{ "data": { "id": "m_9f2...", "type": "pdf", "version": 1, "status": "active", "...": "..." } }
```

**Conflict duplikat**
```json
{
  "error": {
    "code": "DUPLICATE_MATERIAL",
    "message": "Materi dengan DOI yang sama sudah ada.",
    "details": [{ "field": "doi", "message": "Sudah ada pada material m_1a2b3c (Judul X)." }]
  }
}
```

**Version conflict**
```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Materi sudah diubah di tab lain. Muat ulang lalu coba lagi.",
    "details": [{ "field": "version", "message": "diminta: 1, sekarang: 3" }]
  }
}
```

---

## 6. Link Health Check (mekanisme inti)

Kebutuhan: "memperbarui link yang mati seiring berjalannya waktu" harus otomatis, bukan manual.

```
┌─ Scheduler (node-cron / setInterval, tiap 24 jam, saat idle)
│  1. Ambil material status='active' yang url tidak null
│     DAN belum dicek dalam 7 hari terakhir (LIMIT 50 per batch)
│  2. Untuk tiap URL (dengan concurrency 5, timeout 10 detik):
│     - HEAD → jika 405/403, fallback GET dengan Range: bytes=0-0
│     - Follow redirect, catat finalUrl
│  3. Tulis baris link_checks
│  4. Terapkan aturan status:
│       alive  → status tetap 'active' (kecuali bila sebelumnya 'dead' → kembali 'active')
│       gagal 1x → tidak ubah status, tandai di UI "cek terakhir gagal"
│       gagal 2x berturut (atau HTTP 404/410) → status='dead'
│                 + suggested_archive_url diisi
│  5. Jangan pernah mengubah `status` milik user ('reading','archived')
└─
```

Aturan tambahan:
- Redirect lintas domain yang **tidak** ke arsip (mis. drive → goo.gl) = sinyal "link berubah" → beri notifikasi.
- `403` tidak dianggap mati (bisa jadi paywall/login) — klasifikasi `paywall`, hanya beri badge.
- Semua request keluar pakai timeout + `User-Agent` jelas, tanpa mengirim data pribadi.
- Manual check via tombol di UI selalu tersedia untuk satu item.

---

## 7. Deteksi Duplikat

Berurutan, murah → mahal:
1. Exact `doi` cocok (sudah dinormalisasi) → blokir create, tawarkan "perbarui yang lama".
2. Exact URL ternormalisasi cocok → sama.
3. Exact `title` ternormalisasi (lowercase, collapse whitespace, buang "(pdf)", "journal xyz vol 3") → warning.
4. Skor kesamaan: token title (Jaccard ≥ 0.85) + tahun terbit sama → warning "kemungkinan duplikat".

Hasil: `409` untuk duplikat pasti, `200 + warnings[]` untuk kemungkinan (tetap boleh disimpan, tapi ditandai).

---

## 8. Frontend

### 8.1 Halaman
| Route | Isi |
|---|---|
| `/` | Dashboard: statistik, tenggat terdekat, materi bermasalah (mati/duplikat), review hari ini |
| `/materials` | List + filter panel + pencarian + bulk action |
| `/materials/:id` | Detail: metadata, link, lampiran, catatan, tag, mata kuliah, riwayat link, ekspor sitasi |
| `/materials/new` | Form create (dengan deteksi duplikat live) |
| `/materials/:id/edit` | Form edit |
| `/collections` | Tree folder + saved search; drag-and-drop material ke folder |
| `/courses` | CRUD mata kuliah + assignment semester |
| `/trash` | Recycle Bin: restore / purge |
| `/settings` | Backup, restore, import, preferensi, jadwal link check |

### 8.2 Komponen
```
components/
├── common/     Button, Input, Select, MultiSelect, Textarea, Modal, ConfirmModal,
│               Toast, Badge, EmptyState, Spinner, ErrorState, TagInput,
│               Pagination, Tabs, Tooltip
├── material/   MaterialList, MaterialCard, MaterialRow, MaterialFilters,
│               MaterialForm, MaterialDetail, MaterialMetaEditor, LinkHealthBadge,
│               LinkCheckHistory, NoteList, NoteComposer, AttachmentList,
│               TagPicker, CoursePicker, DuplicateWarning, CitationExportDialog
├── dashboard/  StatCard, DeadlineWidget, ProblemWidget, ReviewWidget
└── layout/     AppHeader, AppSidebar, AppLayout, SearchBar
```

### 8.3 State & Interaksi
- **Server state**: React Query (constraint: tanpa global state untuk data server) — cache, retry, invalidasi per-mutasi.
- **UI state lokal** hanya: nilai form, filter terbuka/tutup, tab aktif.
- **Filter tersinkron ke URL** (query params) → filter bisa di-bookmark dan dibuka lagi dari riwayat browser.
- **Bulk action**: checkbox + bar aksi; delete wajib konfirmasi yang menyebut jumlah item.
- **Debounce** 300 ms untuk pencarian; request dibatalkan (AbortController) bila ada ketikan baru.
- **Dedupe live**: form create memanggil `duplicate-check` (debounce 600 ms) setelah title+url terisi.
- **Virtualized list** di atas 200 baris.

---

## 9. Validasi (Ganda)

Skema Zod dipakai bersama oleh frontend & backend (satu sumber kebenaran, di `shared/`), dengan perbedaan: client pakai schema penuh untuk UX, server memakai subset parse + aturan bisnis tambahan.

Aturan ringkas:

| Field | Aturan |
|---|---|
| `title` | wajib, 3–200 karakter setelah trim |
| `url` | opsional bila `type='book'`; kalau ada → `new URL()` valid, protokol `http`/`https` saja, host tidak kosong |
| `doi` | opsional; bila ada harus cocok `/^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/i` |
| `summary` | maks 2000 karakter |
| `importance` | integer 1–5 |
| `authors` | tiap item maks 120 karakter, maks 20 penulis |
| `tagNames` | tiap item 1–40 karakter, lowercase, unik dalam request |
| `courseIds` | harus ID yang ada di `courses` |
| `publishedYear` | 1500..tahun+1 |
| `notes.body` | 1–5000 karakter, tidak boleh whitespace saja |
| `page`/`limit` | limit maks 100 |

**Sanitasi**: semua query SQL memakai parameter binding. Tidak ada input yang masuk ke `ORDER BY` mentah — kolom sort dipetakan lewat allowlist.

---

## 10. Error Handling

| Kode HTTP | `code` | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | gagal Zod; `details` berisi field+pesan |
| 404 | `NOT_FOUND` | material/course/note tidak ada (termasuk yang sudah di-purge) |
| 409 | `DUPLICATE_MATERIAL` | DOI/URL sudah dipakai |
| 409 | `VERSION_CONFLICT` | `version` tidak cocok |
| 409 | `CONFLICT` | course code / tag name duplikat |
| 413 | `PAYLOAD_TOO_LARGE` | lampiran > 25 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | tipe file tidak diizinkan |
| 422 | `UNPROCESSABLE` | file rusak / checksum tidak cocok |
| 429 | `RATE_LIMITED` | import/check massal melewati batas |
| 500 | `INTERNAL_ERROR` | catch-all, pesan generik + `requestId` |

Frontend: service layer mengubah error HTTP menjadi objek typed (`ApiError` dengan `code`, `fieldErrors`, `status`), komponen menampilkan pesan ramah + aksi retry. Tidak pernah menampilkan stack trace ke pengguna; server tetap log lengkap dengan `requestId`.

---

## 11. Keamanan & Privasi

- Aplikasi **lokal-first**, tidak ada data keluar ke pihak ketiga selain HEAD/GET ke URL target saat link check.
- **SQL injection**: parameterized query seluruhnya.
- **Path traversal pada upload**: nama file disimpan acak (`crypto.randomUUID()`), nama asli hanya metadata; path dibangun dari ID yang sudah divalidasi.
- **XSS**: React escaping default; ringkasan yang mengandung HTML disimpan sebagai teks, tidak pernah `dangerouslySetInnerHTML`.
- **SSRF pada link check**: blokir host private/loopback (`127.0.0.1`, `10.x`, `192.168.x`, `169.254.169.254`) sebelum request.
- **Rate limit** pada endpoint mahal (link check, import).
- Path file attachment berada di luar direktori aplikasi, tidak dapat diakses langsung sebagai file statis.

---

## 12. Strategi Pengujian

| Level | Cakupan | Contoh |
|---|---|---|
| Unit | Normalisasi URL/DOI, similarity duplikat, spaced repetition, filter query builder | 90%+ coverage untuk `utils` & service |
| Service (integration) | CRUD + aturan bisnis + cascade | `materialService.create` menolak DOI duplikat |
| Repository (integration) | Query dengan SQLite in-memory **nyata** (tanpa mock) | pagination + sort whitelist |
| API | Kontrak & status code | `PATCH` versi lama → 409 |
| Component | Form, list, empty/error state (React Testing Library) | submit kosong → pesan field |
| E2E (manual script) | Alur utama create → catat → link check → trash → restore | checklist rilis |

Constraint dipatuhi: integration test memakai SQLite sungguhan, test tidak pernah di-skip.

---

## 13. Roadmap (bertahap, bisa dihentikan kapan saja)

| Fase | Isi | Nilai |
|---|---|---|
| **M1 — CRUD inti** | Materials, courses, semester, tag, filter+paginate, search LIKE, soft delete, validasi ganda | Sudah menutup 60% kebutuhan harian |
| **M2 — Temukan ulang** | FTS5, filter majemuk, URL sync, saved search, koleksi, bulk action, ekspor sitasi | Tidak tenggelam di 200+ item |
| **M3 — Kepercayaan** | Deteksi duplikat, link health check + riwayat, arsip Wayback, dashboard "bermasalah" | Mematikan risiko link mati |
| **M4 — Kedalaman** | Catatan append-only, revision history, attachment, spaced repetition, tenggat | Naskah Bab 3 dan persiapan ujian |
| **M5 — Bertahan** | Impor/ekspor, backup/restore, audit log, review/security pass | Data aman jangka panjang |

Fase 1 sudah bernilai; fase berikutnya tidak memblokir satu sama lain.

---

## 14. Catatan Implementasi di Repo Ini

Repo saat ini bernama `employee-management` dan `ARCHITECTURE.md` masih mendeskripsikan domain Employee.
Sebelum kode M1 ditulis, diperlukan persetujuan (sesuai `CONSTRAINTS.md`: "Do not reorganize folder structure without approval"):

1. Ganti domain Employee → Material di seluruh dokumen (`ARCHITECTURE.md`).
2. Tentukan nama folder/project (disarankan `study-material-organizer`).
3. Tambahkan folder `shared/` untuk skema Zod & tipe yang dipakai bersama frontend & backend.
4. Tambah dependensi baru yang **hanya** jika disetujui: `node-cron` (link check terjadwal), `better-sqlite3` + FTS5 (sudah termasuk SQLite), `@tanstack/react-query`, `multer` (upload).

Tanpa persetujuan tersebut, implementasi kode belum dimulai — dokumen ini adalah output desain.
