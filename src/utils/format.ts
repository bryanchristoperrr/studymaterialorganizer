/**
 * Helper format untuk tampilan (tanggal, label enum). Murni & tanpa I/O.
 */

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  web: 'Web',
  drive: 'Google Drive',
  video: 'Video',
  book: 'Buku',
  dataset: 'Dataset',
  slide: 'Slide',
  other: 'Lainnya',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  archived: 'Diarsipkan',
  dead: 'Link mati',
  duplicate: 'Duplikat',
  reading: 'Sedang dibaca',
};

/** Tanggal SQLite ("2026-01-31 10:00:00") atau ISO → format lokal "31 Jan 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Authors disimpan sebagai 'A; B; C' → tampilkan "A, B, C". */
export function formatAuthors(authors: string | null | undefined): string {
  if (!authors) return '-';
  return authors.split(';').map((name) => name.trim()).join(', ');
}

/** Tampilkan maksimal `limit` karakter + ellipsis. */
export function truncate(value: string | null | undefined, limit: number): string {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}
