/**
 * Normalisasi input yang dipakai service layer sebelum data disimpan.
 * Fungsi-fungsi ini murni (tanpa I/O) sehingga mudah diuji unit.
 */

const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAMS = new Set(['gclid', 'fbclid', 'msclkid', 'ref_src', 'ref_url']);

/**
 * B2: normalisasi URL supaya tautan yang menunjuk sumber sama dikenali sebagai satu.
 * - host lowercase + IDN dipunycode
 * - parameter tracking (utm_*, gclid, ...) dibuang
 * - trailing slash dibuang
 * - hash dibuang
 * Returns null bila input bukan URL http/https yang valid.
 */
export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  // Host: lowercase; punycode otomatis dari URL constructor bila IDN.
  parsed.hostname = parsed.hostname.toLowerCase();

  // Buang parameter tracking.
  for (const key of [...parsed.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p)) || TRACKING_PARAMS.has(lower)) {
      parsed.searchParams.delete(key);
    }
  }

  // Urutkan parameter agar '?b=2&a=1' dan '?a=1&b=2' dianggap sama.
  parsed.searchParams.sort();

  parsed.hash = '';

  const pathname = parsed.pathname.replace(/\/+$/, '');
  const search = parsed.searchParams.toString();

  return `${parsed.protocol}//${parsed.host}${pathname}${search ? `?${search}` : ''}`;
}

/**
 * B4: DOI dinormalisasi ke bentuk '10.xxxx/yyy'.
 * Menerima input lepas (URL doi.org, prefiks 'doi:', huruf besar).
 * Returns null bila input kosong; string yang tidak berbentuk DOI dikembalikan apa
 * adanya supaya skema Zod yang menolaknya format tidak valid.
 */
export function normalizeDoi(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const withoutPrefix = trimmed
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');

  return withoutPrefix.toLowerCase();
}

/** B3: inferensi tipe dari host URL (Google Drive → 'drive'). */
export function inferTypeFromUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const host = new URL(input).hostname.toLowerCase();
    if (host === 'drive.google.com' || host.endsWith('.google.com')) return 'drive';
    if (host.endsWith('youtube.com') || host === 'youtu.be') return 'video';
  } catch {
    // URL tidak valid; biarkan validasi skema yang melaporkan error.
  }
  return null;
}

/** Authors disimpan sebagai teks 'A; B; C' — helper ini menjaga format konsisten. */
export function normalizeAuthors(input: string | null | undefined): string | null {
  if (!input) return null;
  const parts = input
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return parts.length > 0 ? parts.join('; ') : null;
}
