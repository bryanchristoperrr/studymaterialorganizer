/**
 * Re-export tipe domain dari shared/ agar komponen cukup mengimpor dari
 * '@/types' dan tidak perlu tahu struktur folder shared.
 */
export type {
  ApiErrorBody,
  ApiListSuccess,
  ApiSuccess,
  Course,
  Importance,
  Material,
  MaterialLanguage,
  MaterialStatus,
  MaterialType,
  MaterialWithRelations,
  Pagination,
  Semester,
  Tag,
} from 'shared/types';

export { MATERIAL_STATUSES, MATERIAL_TYPES } from 'shared/types';
