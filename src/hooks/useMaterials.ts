import { useMemo } from 'react';
import { useAsyncData } from './useAsyncData';
import { materialService, type MaterialFilters } from '@/services/materialService';
import type { MaterialWithRelations } from '@/types';

export interface MaterialListState {
  items: MaterialWithRelations[];
  pagination: { page: number; limit: number; total: number; totalPages: number } | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Memuat daftar material untuk sekumpulan filter. */
export function useMaterials(filters: MaterialFilters): MaterialListState {
  // Serialisasi filter menjadi string agar perbandingan dependency stabil.
  const key = useMemo(() => JSON.stringify(filters), [filters]);

  const state = useAsyncData((signal) => materialService.list(filters, signal), [key]);

  return {
    items: state.data?.items ?? [],
    pagination: state.data?.pagination ?? null,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}
