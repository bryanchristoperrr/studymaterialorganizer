import { describe, expect, it } from 'vitest';
import {
  inferTypeFromUrl,
  normalizeAuthors,
  normalizeDoi,
  normalizeUrl,
} from '../src/utils/normalize.js';

describe('normalizeUrl (B2)', () => {
  it('lowercase host dan membuang trailing slash', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Docs/')).toBe('https://example.com/Docs');
  });

  it('membuang parameter tracking (utm_*, gclid, fbclid)', () => {
    const result = normalizeUrl('https://example.com/a?utm_source=news&id=5&fbclid=abc');
    expect(result).toBe('https://example.com/a?id=5');
  });

  it('mengurutkan parameter agar URL dengan urutan berbeda dianggap sama', () => {
    expect(normalizeUrl('https://example.com/a?b=2&a=1')).toBe(
      normalizeUrl('https://example.com/a?a=1&b=2'),
    );
  });

  it('membuang hash fragment', () => {
    expect(normalizeUrl('https://example.com/a#bab-3')).toBe('https://example.com/a');
  });

  it('menolak URL dengan protokol selain http/https', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('ftp://example.com/file')).toBeNull();
  });

  it('mengembalikan null untuk input kosong atau tidak valid', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl('bukan url')).toBeNull();
  });

  it('mempertahankan port dan path case-sensitive', () => {
    expect(normalizeUrl('http://localhost:3001/API/Materials')).toBe(
      'http://localhost:3001/API/Materials',
    );
  });
});

describe('normalizeDoi (B4)', () => {
  it('melepas prefix doi.org dan men lowercase', () => {
    expect(normalizeDoi('https://doi.org/10.1000/XYZ123')).toBe('10.1000/xyz123');
    expect(normalizeDoi('doi: 10.1000/ABC')).toBe('10.1000/abc');
  });

  it('mengembalikan null untuk input kosong', () => {
    expect(normalizeDoi('   ')).toBeNull();
    expect(normalizeDoi(null)).toBeNull();
  });
});

describe('inferTypeFromUrl (B3)', () => {
  it('mengenali Google Drive dan YouTube', () => {
    expect(inferTypeFromUrl('https://drive.google.com/file/d/abc/view')).toBe('drive');
    expect(inferTypeFromUrl('https://youtu.be/abc')).toBe('video');
  });

  it('mengembalikan null untuk host lain atau URL rusak', () => {
    expect(inferTypeFromUrl('https://example.com')).toBeNull();
    expect(inferTypeFromUrl('bukan-url')).toBeNull();
    expect(inferTypeFromUrl(null)).toBeNull();
  });
});

describe('normalizeAuthors', () => {
  it('menyatukan kembali penulis yang dipisah titik koma', () => {
    expect(normalizeAuthors('Andi ; Budi;  Citra ')).toBe('Andi; Budi; Citra');
  });

  it('mengembalikan null bila tidak ada penulis', () => {
    expect(normalizeAuthors(' ; ; ')).toBeNull();
    expect(normalizeAuthors(null)).toBeNull();
  });
});
