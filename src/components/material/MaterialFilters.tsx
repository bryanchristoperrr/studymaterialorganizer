import { Select } from '@/components/common/Input';
import { MATERIAL_STATUSES, MATERIAL_TYPES } from '@/types';
import type { Course, Semester, Tag } from '@/types';

export interface MaterialFilterState {
  type: string[];
  status: string[];
  courseId: string[];
  semesterId: string[];
  tagId: string[];
  importanceMin: string;
}

export const EMPTY_FILTERS: MaterialFilterState = {
  type: [],
  status: [],
  courseId: [],
  semesterId: [],
  tagId: [],
  importanceMin: '',
};

interface MaterialFiltersProps {
  value: MaterialFilterState;
  onChange: (value: MaterialFilterState) => void;
  courses: Course[];
  semesters: Semester[];
  tags: Tag[];
  onReset: () => void;
}

/** Panel filter majemuk: tipe, status, mata kuliah, semester, tag, importance. */
export function MaterialFilters({
  value,
  onChange,
  courses,
  semesters,
  tags,
  onReset,
}: MaterialFiltersProps) {
  const setValue = (patch: Partial<MaterialFilterState>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="filters">
      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-type">
          Tipe
        </label>
        <Select
          id="filter-type"
          value={value.type[0] ?? ''}
          onChange={(event) => setValue({ type: event.target.value ? [event.target.value] : [] })}
        >
          <option value="">Semua tipe</option>
          {MATERIAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-status">
          Status
        </label>
        <Select
          id="filter-status"
          value={value.status[0] ?? ''}
          onChange={(event) => setValue({ status: event.target.value ? [event.target.value] : [] })}
        >
          <option value="">Semua status</option>
          {MATERIAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-course">
          Mata kuliah
        </label>
        <Select
          id="filter-course"
          value={value.courseId[0] ?? ''}
          onChange={(event) =>
            setValue({ courseId: event.target.value ? [event.target.value] : [] })
          }
        >
          <option value="">Semua mata kuliah</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} — {course.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-semester">
          Semester
        </label>
        <Select
          id="filter-semester"
          value={value.semesterId[0] ?? ''}
          onChange={(event) =>
            setValue({ semesterId: event.target.value ? [event.target.value] : [] })
          }
        >
          <option value="">Semua semester</option>
          {semesters.map((semester) => (
            <option key={semester.id} value={semester.id}>
              {semester.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-tag">
          Tag
        </label>
        <Select
          id="filter-tag"
          value={value.tagId[0] ?? ''}
          onChange={(event) => setValue({ tagId: event.target.value ? [event.target.value] : [] })}
        >
          <option value="">Semua tag</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name} ({tag.materialCount})
            </option>
          ))}
        </Select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-importance">
          Importance minimal
        </label>
        <Select
          id="filter-importance"
          value={value.importanceMin}
          onChange={(event) => setValue({ importanceMin: event.target.value })}
        >
          <option value="">Semua</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              {level} ke atas
            </option>
          ))}
        </Select>
      </div>

      <div className="filters__field">
        <span className="filters__label">&nbsp;</span>
        <button type="button" className="button button--secondary" onClick={onReset}>
          Reset filter
        </button>
      </div>
    </div>
  );
}
