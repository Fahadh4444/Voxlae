"use client";

/**
 * UIContext — Global UI state
 *
 * Manages:
 *  - Toast notifications (success / error / warning / info)
 *  - Modal system
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/* ── Toast ──────────────────────────────── */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // ms, default 4000
}

/* ── Modal ──────────────────────────────── */
export interface ModalConfig {
  title: string;
  content: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'danger';
}

/* ── Context value ──────────────────────── */
interface UIContextValue {
  /* Toasts */
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismissToast: (id: string) => void;

  /* Modal */
  modal: ModalConfig | null;
  showModal: (config: ModalConfig) => void;
  closeModal: () => void;

  /* Auth transition — full-screen loader shown from a successful sign-in
     until the destination route takes over (bridges the modal-close → navigate gap). */
  authTransition: boolean;
  setAuthTransition: (active: boolean) => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

let toastIdCounter = 0;

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [authTransition, setAuthTransition] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = `toast-${++toastIdCounter}`;
    setToasts(prev => [...prev, { id, message, variant, duration }]);

    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
  }, [dismissToast]);

  const showModal = useCallback((config: ModalConfig) => setModal(config), []);
  const closeModal = useCallback(() => setModal(null), []);

  const value = useMemo<UIContextValue>(() => ({
    toasts,
    showToast,
    dismissToast,
    modal,
    showModal,
    closeModal,
    authTransition,
    setAuthTransition,
  }), [toasts, showToast, dismissToast, modal, showModal, closeModal, authTransition]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};

export default UIContext;
