import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
}

/** Modal dasar: ditutup dengan Escape atau klik backdrop. */
export function Modal({ isOpen, title, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="modal__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Konfirmasi untuk aksi destruktif (delete, purge). */
export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  tone = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel}>
      <p className="modal__description">{description}</p>
      <div className="modal__actions">
        <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} disabled={isBusy}>
          {isBusy ? 'Memproses…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
