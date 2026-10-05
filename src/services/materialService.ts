/**
 * Service material: seluruh panggilan API terkait material.
 * Komponen tidak pernah memanggil fetch langsung (ARCHITECTURE.md).
 */
import { request } from './apiClient';
import type { MaterialsQuery } from 'shared/schemas';
import type { Material, MaterialWithRelations, Pagination } from '@/types';

export interface MaterialFilters {
  search?: string;
  type?: string[];
  courseId?: string[];
  semesterId?: string[];
  tagId?: string[];
  status?: string[];
  importanceMin?: number;
  sort?: MaterialsQuery['sort'];
  order?: MaterialsQuery['order'];
  page?: number;
  limit?: number;
}

export interface MaterialListResult {
  items: MaterialWithRelations[];
  pagination: Pagination;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicate: { id: string; title: string; doi: string | null; url: string | null } | null;
}

export const materialService = {
  /** List + filter + paginate. */
  async list(filters: MaterialFilters, signal?: AbortSignal): Promise<MaterialListResult> {
    const payload = await request<ApiListShape>('/materials', {
      signal,
      query: {
        search: filters.search,
        type: filters.type,
        courseId: filters.courseId,
        semesterId: filters.semesterId,
        tagId: filters.tagId,
        status: filters.status,
        importanceMin: filters.importanceMin,
        sort: filters.sort,
        order: filters.order,
        page: filters.page,
        limit: filters.limit,
      },
    });

    const list = payload;
    return { items: list.data, pagination: list.pagination };
  },

  getById(id: string, signal?: AbortSignal): Promise<MaterialWithRelations> {
    return request<MaterialWithRelations>(`/materials/${id}`, { signal });
  },

  create(input: Record<string, unknown>): Promise<Material> {
    return request<Material>('/materials', { method: 'POST', body: input });
  },

  /** PATCH partial: `version` wajib agar server dapat menolak update basi (B8). */
  update(id: string, input: Record<string, unknown>): Promise<Material> {
    return request<Material>(`/materials/${id}`, { method: 'PATCH', body: input });
  },

  remove(id: string): Promise<void> {
    return request<void>(`/materials/${id}`, { method: 'DELETE' });
  },

  restore(id: string): Promise<Material> {
    return request<Material>(`/materials/${id}/restore`, { method: 'POST' });
  },

  purge(id: string): Promise<void> {
    return request<void>(`/materials/${id}/purge`, { method: 'DELETE' });
  },

  checkDuplicates(input: { doi?: string | null; url?: string | null }): Promise<DuplicateCheckResult> {
    return request<DuplicateCheckResult>('/materials/duplicate-check', {
      method: 'POST',
      body: input,
    });
  },
};

interface ApiListShape {
  data: MaterialWithRelations[];
  pagination: Pagination;
}
