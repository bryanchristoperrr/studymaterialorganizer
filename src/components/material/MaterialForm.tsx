import { useState } from 'react';
import type { FormEvent } from 'react';
import { createMaterialSchema } from 'shared/schemas';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { Field } from '@/components/common/Field';
import { Input, Select, Textarea } from '@/components/common/Input';
import { TagInput } from '@/components/common/TagInput';
import { MATERIAL_TYPES } from '@/types';
import type { Course, MaterialWithRelations } from '@/types';

interface MaterialFormProps {
  mode: 'create' | 'edit';
  /** Data awal untuk mode edit; undefined untuk mode create. */
  material?: MaterialWithRelations;
  courses: Course[];
  /** Dipanggil dengan payload yang SUDAH divalidasi client-side. */
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

/** Bentuk form sepenuhnya string agar mudah dipasok ke <input>. */
interface FormState {
  type: string;
  title: string;
  url: string;
  doi: string;
  sourceName: string;
  authors: string;
  publishedYear: string;
  publisher: string;
  volume: string;
  issue: string;
  pages: string;
  language: string;
  summary: string;
  importance: string;
  status: string;
  deadlineAt: string;
  courseIds: string[];
  tagNames: string[];
}

function toFormState(material?: MaterialWithRelations): FormState {
  return {
    type: material?.type ?? 'pdf',
    title: material?.title ?? '',
    url: material?.url ?? '',
    doi: material?.doi ?? '',
    sourceName: material?.sourceName ?? '',
    authors: material?.authors ?? '',
    publishedYear: material?.publishedYear ? String(material.publishedYear) : '',
    publisher: material?.publisher ?? '',
    volume: material?.volume ?? '',
    issue: material?.issue ?? '',
    pages: material?.pages ?? '',
    language: material?.language ?? '',
    summary: material?.summary ?? '',
    importance: material ? String(material.importance) : '2',
    status: material?.status ?? 'active',
    // <input type="datetime-local"> memakai format 'YYYY-MM-DDTHH:mm'
    // dalam zona waktu lokal — dikonversi dari ISO UTC milik server.
    deadlineAt: material?.deadlineAt ? toLocalInputValue(material.deadlineAt) : '',
    courseIds: material?.courseIds ?? [],
    tagNames: material?.tagNames ?? [],
  };
}

/**
 * Form create/edit.
 *
 * Validasi: skema shared (satu sumber kebenaran) dijalankan sebelum request,
 * lalu error 400 dari server dipetakan kembali ke field terkait lewat
 * `ApiError.fieldErrors` — sehingga pesan tetap muncul di kolom yang benar.
 */
export function MaterialForm({ mode, material, courses, onSubmit, onCancel }: MaterialFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(material));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field: keyof FormState, value: string | string[]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    // Hapus error field ini begitu pengguna memperbaiki isinya.
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    // publishedYear & importance dikirim sebagai number agar sesuai skema server.
    const candidate = {
      type: form.type,
      title: form.title,
      url: form.url,
      doi: form.doi,
      sourceName: form.sourceName,
      authors: form.authors,
      publishedYear: form.publishedYear === '' ? null : Number(form.publishedYear),
      publisher: form.publisher,
      volume: form.volume,
      issue: form.issue,
      pages: form.pages,
      language: form.language === '' ? null : form.language,
      summary: form.summary,
      importance: Number(form.importance),
      status: form.status,
      // Konversi dari waktu lokal ke ISO UTC agar tidak bergeser jam.
      deadlineAt: form.deadlineAt ? toIsoValue(form.deadlineAt) : null,
      courseIds: form.courseIds,
      tagNames: form.tagNames,
      ...(mode === 'edit' ? { version: material?.version ?? 1 } : {}),
    };

    const parsed = createMaterialSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Kirim hasil parse (bukan kandidat mentah) agar '' sudah jadi null.
      await onSubmit({ ...parsed.data, version: mode === 'edit' ? material?.version : undefined });
    } catch (error) {
      // Error field dari server diprioritaskan; selain itu tampilkan pesan umum.
      const fieldErrorsFromServer = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
      if (fieldErrorsFromServer && Object.keys(fieldErrorsFromServer).length > 0) {
        setErrors(fieldErrorsFromServer);
        setSubmitError('Periksa kembali field yang ditandai.');
      } else {
        setSubmitError((error as Error).message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      <div className="form-grid">
        <Field label="Judul" htmlFor="title" error={errors.title}>
          <Input
            id="title"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            placeholder="Analisis Regresi Linier Berganda"
            error={errors.title}
          />
        </Field>

        <Field label="Tipe sumber" htmlFor="type" error={errors.type}>
          <Select
            id="type"
            value={form.type}
            onChange={(event) => setField('type', event.target.value)}
            error={errors.type}
          >
            {MATERIAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="URL"
        htmlFor="url"
        hint="Wajib kecuali tipe buku. Tautan Google Drive akan dikenali otomatis."
        error={errors.url}
      >
        <Input
          id="url"
          type="url"
          value={form.url}
          onChange={(event) => setField('url', event.target.value)}
          placeholder="https://drive.google.com/file/d/…"
          error={errors.url}
        />
      </Field>

      <div className="form-grid">
        <Field label="DOI" htmlFor="doi" hint="Boleh dikosongkan." error={errors.doi}>
          <Input
            id="doi"
            value={form.doi}
            onChange={(event) => setField('doi', event.target.value)}
            placeholder="10.1000/xyz123"
            error={errors.doi}
          />
        </Field>

        <Field label="Tahun terbit" htmlFor="publishedYear" error={errors.publishedYear}>
          <Input
            id="publishedYear"
            type="number"
            value={form.publishedYear}
            onChange={(event) => setField('publishedYear', event.target.value)}
            error={errors.publishedYear}
          />
        </Field>
      </div>

      <div className="form-grid">
        <Field label="Nama jurnal / sumber" htmlFor="sourceName" error={errors.sourceName}>
          <Input
            id="sourceName"
            value={form.sourceName}
            onChange={(event) => setField('sourceName', event.target.value)}
            error={errors.sourceName}
          />
        </Field>

        <Field label="Penulis" htmlFor="authors" hint="Pisahkan dengan titik koma." error={errors.authors}>
          <Input
            id="authors"
            value={form.authors}
            onChange={(event) => setField('authors', event.target.value)}
            placeholder="Andi; Budi; Citra"
            error={errors.authors}
          />
        </Field>
      </div>

      <div className="form-grid">
        <Field label="Publisher" htmlFor="publisher" error={errors.publisher}>
          <Input
            id="publisher"
            value={form.publisher}
            onChange={(event) => setField('publisher', event.target.value)}
            error={errors.publisher}
          />
        </Field>

        <Field label="Volume / issue / halaman" htmlFor="volume" error={errors.volume}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              id="volume"
              aria-label="Volume"
              value={form.volume}
              onChange={(event) => setField('volume', event.target.value)}
            />
            <Input
              id="issue"
              aria-label="Issue"
              value={form.issue}
              onChange={(event) => setField('issue', event.target.value)}
            />
            <Input
              id="pages"
              aria-label="Halaman"
              value={form.pages}
              onChange={(event) => setField('pages', event.target.value)}
            />
          </div>
        </Field>
      </div>

      <Field label="Ringkasan singkat" htmlFor="summary" error={errors.summary}>
        <Textarea
          id="summary"
          value={form.summary}
          onChange={(event) => setField('summary', event.target.value)}
          placeholder="Bab 3 skripsi: berisi uji asumsi klasik regresi…"
          error={errors.summary}
        />
      </Field>

      <div className="form-grid">
        <Field label="Mata kuliah" htmlFor="course-picker" error={errors.courseIds}>
          <div id="course-picker" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {courses.length === 0 ? (
              <span className="field__hint">Belum ada mata kuliah. Tambahkan di halaman Courses.</span>
            ) : (
              courses.map((course) => (
                <label key={course.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.courseIds.includes(course.id)}
                    onChange={(event) =>
                      setField(
                        'courseIds',
                        event.target.checked
                          ? [...form.courseIds, course.id]
                          : form.courseIds.filter((id) => id !== course.id),
                      )
                    }
                  />
                  {course.code} — {course.name}
                </label>
              ))
            )}
          </div>
        </Field>

        <Field label="Tag" htmlFor="tags" hint="Tekan Enter untuk menambah tag.">
          <TagInput
            id="tags"
            values={form.tagNames}
            onChange={(values) => setField('tagNames', values)}
            placeholder="skripsi, statistika…"
          />
        </Field>
      </div>

      <div className="form-grid">
        <Field label="Importance (1–5)" htmlFor="importance" error={errors.importance}>
          <Select
            id="importance"
            value={form.importance}
            onChange={(event) => setField('importance', event.target.value)}
            error={errors.importance}
          >
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="status" error={errors.status}>
          <Select
            id="status"
            value={form.status}
            onChange={(event) => setField('status', event.target.value)}
            disabled={mode === 'create'}
          >
            <option value="active">active</option>
            <option value="reading">reading</option>
            <option value="archived">archived</option>
            <option value="dead">dead</option>
            <option value="duplicate">duplicate</option>
          </Select>
        </Field>
      </div>

      <div className="form-grid">
        <Field
          label="Deadline (opsional)"
          htmlFor="deadlineAt"
          hint="Untuk materi yang wajib ditinjau sebelum ujian."
          error={errors.deadlineAt}
        >
          <Input
            id="deadlineAt"
            type="datetime-local"
            value={form.deadlineAt}
            onChange={(event) => setField('deadlineAt', event.target.value)}
            error={errors.deadlineAt}
          />
        </Field>

        <Field label="Bahasa" htmlFor="language">
          <Select
            id="language"
            value={form.language}
            onChange={(event) => setField('language', event.target.value)}
          >
            <option value="">Tidak diisi</option>
            <option value="id">Indonesia</option>
            <option value="en">English</option>
            <option value="other">Lainnya</option>
          </Select>
        </Field>
      </div>

      <div className="form-actions">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : mode === 'create' ? 'Simpan materi' : 'Simpan perubahan'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Batal
        </Button>
      </div>
    </form>
  );
}

/**
 * ISO datetime (UTC dari server) → 'YYYY-MM-DDTHH:mm' untuk
 * <input type="datetime-local">. Konversi zona waktu diperlukan
 * agar waktu lokal tersimpan & ditampilkan konsisten.
 */
function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 'YYYY-MM-DDTHH:mm' (lokal) → ISO UTC yang diterima skema server. */
function toIsoValue(localInput: string): string {
  const date = new Date(localInput);
  // new Date('YYYY-MM-DDTHH:mm') diparsing sebagai waktu LOKAL;
  // toISOString() mengubahnya ke UTC tanpa pergeseran jam.
  return Number.isNaN(date.getTime()) ? localInput : date.toISOString();
}
