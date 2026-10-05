/**
 * Service course & semester: aturan bisnis penataan mata kuliah.
 * B10: kode course unik (perbandingan case-insensitive, disimpan uppercase).
 */
import { randomUUID } from 'node:crypto';
import type { Course, CourseInput, CoursePatch, Semester, SemesterInput } from '../../../shared/types';
import type { CourseRepository, SemesterRepository } from '../repositories/courseRepository';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

const TERM_LABEL: Record<Semester['term'], string> = {
  ganjil: 'Ganjil',
  genap: 'Genap',
};

export class CourseService {
  constructor(
    private readonly courses: CourseRepository,
    private readonly semesters: SemesterRepository,
  ) {}

  listCourses(): Course[] {
    return this.courses.findAll();
  }

  getCourse(id: string): Course {
    const course = this.courses.findById(id);
    if (!course) throw new NotFoundError(`Mata kuliah dengan id "${id}" tidak ditemukan.`);
    return course;
  }

  createCourse(input: CourseInput): Course {
    this.assertSemesterExists(input.semesterId ?? null);
    // B10: normalisasi di service, bukan hanya di skema, agar aturan tetap berlaku
    // dipanggil dari mana pun (API, test, skrip).
    const code = input.code.toUpperCase();
    this.assertCodeAvailable(code);

    return this.courses.insert({
      id: `c_${randomUUID()}`,
      code,
      name: input.name,
      semesterId: input.semesterId ?? null,
      lecturer: input.lecturer ?? null,
      credits: input.credits ?? null,
      color: input.color ?? null,
    });
  }

  updateCourse(id: string, input: CoursePatch): Course {
    const course = this.getCourse(id);
    this.assertSemesterExists(input.semesterId ?? null);
    const code = input.code ? input.code.toUpperCase() : course.code;
    if (code !== course.code) {
      this.assertCodeAvailable(code, id);
    }

    const updated = this.courses.update(id, {
      code,
      name: input.name ?? course.name,
      semesterId: input.semesterId === undefined ? course.semesterId : input.semesterId,
      lecturer: input.lecturer === undefined ? course.lecturer : input.lecturer,
      credits: input.credits === undefined ? course.credits : input.credits,
      color: input.color === undefined ? course.color : input.color,
    });

    if (!updated) throw new NotFoundError(`Mata kuliah dengan id "${id}" tidak ditemukan.`);
    return updated;
  }

  /** Material yang berelasi TIDAK ikut terhapus (lihat ARCHITECTURE.md, B7). */
  deleteCourse(id: string): void {
    this.getCourse(id);
    this.courses.remove(id);
  }

  listSemesters(): Semester[] {
    return this.semesters.findAll();
  }

  createSemester(input: SemesterInput): Semester {
    const existing = this.semesters.findAll().find(
      (semester) => semester.term === input.term && semester.year === input.year,
    );
    if (existing) {
      throw new ConflictError('Semester untuk periode tersebut sudah ada.', [
        { field: 'term', message: `Sudah terdaftar: ${existing.label}` },
      ]);
    }

    return this.semesters.insert({
      id: `s_${randomUUID()}`,
      term: input.term,
      year: input.year,
      label: input.label?.trim() || `${input.year} ${TERM_LABEL[input.term]}`,
    });
  }

  private assertCodeAvailable(code: string, excludeId?: string): void {
    const existing = this.courses.findByCode(code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError('Kode mata kuliah sudah dipakai.', [
        { field: 'code', message: `Kode "${existing.code}" sudah dipakai oleh "${existing.name}"` },
      ]);
    }
  }

  private assertSemesterExists(semesterId: string | null): void {
    if (!semesterId) return;
    if (!this.semesters.findById(semesterId)) {
      throw new ValidationError('Semester tidak ditemukan.', [
        { field: 'semesterId', message: `ID semester tidak dikenal: ${semesterId}` },
      ]);
    }
  }
}
