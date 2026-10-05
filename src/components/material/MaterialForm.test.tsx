import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MaterialForm } from './MaterialForm';

const defaultProps = {
  mode: 'create' as const,
  courses: [],
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('MaterialForm', () => {
  it('menampilkan error per-field bila form dikirim kosong', async () => {
    const user = userEvent.setup();
    render(<MaterialForm {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Simpan materi' }));

    // Judul & URL wajib (B1): nilai kosong melanggar batas minimum.
    expect(await screen.findByText('Judul minimal 3 karakter')).toBeInTheDocument();
    expect(screen.getByText('URL wajib diisi untuk tipe selain book')).toBeInTheDocument();
    // onSubmit tidak dipanggil karena validasi client gagal.
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('menolak URL tanpa protokol http(s)', async () => {
    const user = userEvent.setup();
    render(<MaterialForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Judul'), 'Materi Uji');
    await user.type(screen.getByLabelText('URL'), 'bukan-url');
    await user.click(screen.getByRole('button', { name: 'Simpan materi' }));

    expect(await screen.findByText('Format URL tidak valid')).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('mengirim data tervalidasi saat form lengkap', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MaterialForm {...defaultProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Judul'), 'Materi Uji Valid');
    await user.type(screen.getByLabelText('URL'), 'https://example.com/materi.pdf');
    await user.type(screen.getByLabelText('Ringkasan singkat'), 'Ringkasan untuk ujian.');
    await user.type(screen.getByLabelText('DOI'), 'https://doi.org/10.1000/ABC');
    await user.type(screen.getByLabelText('Penulis'), 'Andi; Budi');
    await user.click(screen.getByRole('button', { name: 'Simpan materi' }));

    // Tunggu promise submit selesai, lalu periksa payload.
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.title).toBe('Materi Uji Valid');
    expect(payload.url).toBe('https://example.com/materi.pdf');
    // DOI dinormalisasi di skema shared (B4).
    expect(payload.doi).toBe('10.1000/abc');
    expect(payload.authors).toBe('Andi; Budi');
    expect(payload.importance).toBe(2);
    expect(payload.publishedYear).toBeNull();
  });

  it('mengizinkan buku tanpa URL (B1)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MaterialForm {...defaultProps} onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText('Tipe sumber'), 'book');
    await user.type(screen.getByLabelText('Judul'), 'Buku Statistika');
    await user.click(screen.getByRole('button', { name: 'Simpan materi' }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const payload = onSubmit.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.type).toBe('book');
    expect(payload.url).toBeNull();
  });

  it('memetakan error server ke field yang tepat', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockImplementation(() => {
      const error = new Error('Materi dengan URL yang sama sudah ada.') as Error & {
        fieldErrors: Record<string, string>;
      };
      error.fieldErrors = { url: 'Sudah digunakan oleh "Materi Lama" (m_1)' };
      throw error;
    });

    render(<MaterialForm {...defaultProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Judul'), 'Materi Uji');
    await user.type(screen.getByLabelText('URL'), 'https://example.com/materi.pdf');
    await user.click(screen.getByRole('button', { name: 'Simpan materi' }));

    expect(await screen.findByText('Sudah digunakan oleh "Materi Lama" (m_1)')).toBeInTheDocument();
  });
});
