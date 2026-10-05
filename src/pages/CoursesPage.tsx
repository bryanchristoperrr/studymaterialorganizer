import { useState } from 'react';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/Modal';
import { Field } from '@/components/common/Field';
import { Input, Select } from '@/components/common/Input';
import { useCourseOptions } from '@/hooks/useCourseOptions';
import { courseService, semesterService } from '@/services/courseService';
import { toUserMessage } from '@/services/apiError';
import type { Course } from '@/types';

/**
 * Halaman pengelolaan mata kuliah & semester.
 * Data dimuat ulang setelah setiap mutasi agar selalu menampilkan state terbaru.
 */
export function CoursesPage() {
  const { courses, semesters, loading, error, reload } = useCourseOptions();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Mata kuliah yang sedang menunggu konfirmasi hapus.
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state lokal (bukan server state).
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [term, setTerm] = useState<'ganjil' | 'genap'>('ganjil');
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const handleCreateCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      await courseService.create({
        code,
        name,
        semesterId: semesterId || null,
      });
      setCode('');
      setName('');
      reload();
    } catch (cause) {
      setFormError(toUserMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSemester = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      await semesterService.create({ term, year: Number(year) });
      reload();
    } catch (cause) {
      setFormError(toUserMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };

  /** Hapus course: relasi ke material dilepas, materi tidak ikut terhapus. */
  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    setFormError(null);
    try {
      await courseService.remove(courseToDelete.id);
      setCourseToDelete(null);
      reload();
    } catch (cause) {
      setFormError(toUserMessage(cause));
      setCourseToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const semesterById = new Map(semesters.map((semester) => [semester.id, semester.label]));

  return (
    <>
      <h1>Mata Kuliah & Semester</h1>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tambah mata kuliah</h2>
        <form onSubmit={handleCreateCourse}>
          <div className="form-grid">
            <Field label="Kode" htmlFor="course-code" hint="Contoh: IF401">
              <Input
                id="course-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="IF401"
              />
            </Field>
            <Field label="Nama mata kuliah" htmlFor="course-name">
              <Input
                id="course-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Kecerdasan Artifisial"
              />
            </Field>
          </div>
          <Field label="Semester" htmlFor="course-semester">
            <Select
              id="course-semester"
              value={semesterId}
              onChange={(event) => setSemesterId(event.target.value)}
            >
              <option value="">Belum ditentukan</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="form-actions">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Menyimpan…' : 'Simpan mata kuliah'}
            </Button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Semester terdaftar</h2>
        <ul>
          {semesters.map((semester) => (
            <li key={semester.id}>{semester.label}</li>
          ))}
        </ul>
        <form onSubmit={handleCreateSemester} className="toolbar">
          <Field label="Periode" htmlFor="semester-term">
            <Select
              id="semester-term"
              value={term}
              onChange={(event) => setTerm(event.target.value as 'ganjil' | 'genap')}
            >
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </Select>
          </Field>
          <Field label="Tahun" htmlFor="semester-year">
            <Input
              id="semester-year"
              type="number"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={isSaving}>
            Tambah semester
          </Button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Daftar mata kuliah</h2>
        {loading ? <p>Memuat…</p> : null}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Semester</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="code-cell">{course.code}</td>
                  <td>{course.name}</td>
                  <td>{course.semesterId ? (semesterById.get(course.semesterId) ?? '-') : '-'}</td>
                  <td className="text-right">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setCourseToDelete(course)}
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && courses.length === 0 ? (
            <p className="field__hint">Belum ada mata kuliah.</p>
          ) : null}
        </div>
      </div>

      <p className="field__hint" style={{ marginTop: 12 }}>
        <button type="button" className="button button--secondary button--small" onClick={reload}>
          Muat ulang
        </button>
      </p>

      <ConfirmModal
        isOpen={courseToDelete !== null}
        title="Hapus mata kuliah ini?"
        description={
          courseToDelete
            ? `"${courseToDelete.code} — ${courseToDelete.name}" akan dihapus. Materi yang merujuknya TIDAK ikut terhapus, hanya hubungannya yang dilepas.`
            : ''
        }
        confirmLabel="Ya, hapus"
        tone="danger"
        isBusy={isDeleting}
        onConfirm={handleDeleteCourse}
        onCancel={() => setCourseToDelete(null)}
      />
    </>
  );
}
