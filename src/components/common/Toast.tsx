"use client";

/**
 * ToastContainer — Renders active toasts from UIContext
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useUI, Toast as ToastType } from '../../context/UIContext';
import '../../styles/components/Toast.css';

const variantIcons: Record<string, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

const ToastItem: React.FC<{ toast: ToastType; onDismiss: () => void }> = ({ toast, onDismiss }) => (
  <div className={`vx-toast vx-toast--${toast.variant}`} role="alert">
    <span className="vx-toast__icon">{variantIcons[toast.variant]}</span>
    <span className="vx-toast__message">{toast.message}</span>
    <button className="vx-toast__close" onClick={onDismiss} aria-label="Dismiss">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
);

const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useUI();

  if (toasts.length === 0) return null;

  // Portal to <body> so the container lives in the top-level stacking context and
  // its z-index is never trapped/capped by a modal ancestor's stacking context —
  // guaranteeing toasts render above every dialog and its backdrop blur.
  return createPortal(
    <div className="vx-toast-container" aria-live="polite">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
