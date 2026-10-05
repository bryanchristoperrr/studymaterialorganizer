import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MaterialList } from './MaterialList';

const baseProps = {
  items: [],
  loading: false,
  error: null,
  page: 1,
  totalPages: 1,
  total: 0,
  onPageChange: vi.fn(),
  onRetry: vi.fn(),
  courseNameById: new Map<string, string>(),
  isFiltered: false,
};

describe('MaterialList', () => {
  it('menampilkan spinner saat memuat', () => {
    render(
      <MemoryRouter>
        <MaterialList {...baseProps} loading />
      </MemoryRouter>,
    );
    expect(screen.getByText('Memuat materi…')).toBeInTheDocument();
  });

  it('menampilkan empty state + tombol tambah bila belum ada data', () => {
    render(
      <MemoryRouter>
        <MaterialList {...baseProps} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Belum ada materi')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tambah materi' }),
    ).toBeInTheDocument();
  });

  it('menampilkan pesan berbeda bila filter tidak cocok', () => {
    render(
      <MemoryRouter>
        <MaterialList {...baseProps} isFiltered />
      </MemoryRouter>,
    );

    expect(screen.getByText('Tidak ada materi yang cocok')).toBeInTheDocument();
  });

  it('menampilkan error dengan tombol retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <MaterialList {...baseProps} error="Tidak dapat terhubung ke server." onRetry={onRetry} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Gagal memuat daftar materi')).toBeInTheDocument();
    expect(screen.getByText('Tidak dapat terhubung ke server.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('merender kartu untuk setiap item beserta badge tipe & status', () => {
    const items = [
      {
        id: 'm_1',
        type: 'pdf' as const,
        title: 'Bahan Ujian Statistika',
        url: 'https://example.com/a.pdf',
        doi: null,
        sourceName: 'Jurnal Contoh',
        authors: 'Andi; Budi',
        publishedYear: 2024,
        publisher: null,
        volume: null,
        issue: null,
        pages: null,
        language: null,
        summary: 'Ringkasan singkat untuk ujian.',
        importance: 4 as const,
        status: 'active' as const,
        deadlineAt: null,
        version: 1,
        deletedAt: null,
        createdAt: '2026-01-01 00:00:00',
        updatedAt: '2026-01-05 00:00:00',
        courseIds: ['c_1'],
        tagNames: ['statistika'],
      },
    ];

    render(
      <MemoryRouter>
        <MaterialList
          {...baseProps}
          items={items}
          total={1}
          courseNameById={new Map([['c_1', 'IF401 — Statistika']])}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Bahan Ujian Statistika')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();
    expect(screen.getByText('Ringkasan singkat untuk ujian.')).toBeInTheDocument();
    expect(screen.getByText('Mata kuliah: IF401 — Statistika')).toBeInTheDocument();
  });
});
