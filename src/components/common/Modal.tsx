"use client";

/**
 * Modal — Reusable dialog modal
 * Controlled by UIContext
 */

import React, { useEffect, useRef } from 'react';
import { useUI } from '../../context/UIContext';
import Button from './Button';
import '../../styles/components/Modal.css';

const Modal: React.FC = () => {
  const { modal, closeModal } = useUI();
  const overlayRef = useRef<HTMLDivElement>(null);

  /* Close on Escape */
  useEffect(() => {
    if (!modal) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modal, closeModal]);

  /* Close on overlay click */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      if (modal?.onCancel) modal.onCancel();
      closeModal();
    }
  };

  if (!modal) return null;

  return (
    <div className="vx-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="vx-modal" role="dialog" aria-modal="true" aria-labelledby="vx-modal-title">
        <header className="vx-modal__header">
          <h3 id="vx-modal-title" className="vx-modal__title">{modal.title}</h3>
          <button className="vx-modal__close" onClick={() => { modal.onCancel?.(); closeModal(); }} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="vx-modal__body">{modal.content}</div>

        <footer className="vx-modal__footer">
          {modal.cancelLabel && (
            <Button variant="ghost" onClick={() => { modal.onCancel?.(); closeModal(); }}>
              {modal.cancelLabel}
            </Button>
          )}
          {modal.confirmLabel && (
            <Button
              variant={modal.variant === 'danger' ? 'danger' : 'primary'}
              onClick={() => { modal.onConfirm?.(); closeModal(); }}
            >
              {modal.confirmLabel}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default Modal;
