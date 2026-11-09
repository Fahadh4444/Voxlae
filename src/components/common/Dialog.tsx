"use client";

/**
 * Dialog — generic modal shell for forms and rich content.
 *
 * The existing `Modal` is a UIContext-driven confirm box; this is the
 * companion for anything that needs its own body (forms, previews, wizards).
 *
 * Handles the accessibility plumbing so callers don't have to: Escape to close,
 * click-outside to close, body scroll lock, focus moved into the dialog on open
 * and restored to the trigger on close.
 *
 * Goes full-screen on mobile, where a centred box would be unusable.
 */

import React, { useEffect, useRef } from 'react';
import '../../styles/components/Dialog.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Sticky action bar pinned to the bottom (e.g. Cancel / Save). */
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  /**
   * When false, the dialog cannot be dismissed (no close button, Escape and
   * backdrop clicks are ignored). Used for blocking setup wizards that gate
   * the app until completed. Defaults to true.
   */
  dismissible?: boolean;
}

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  dismissible = true,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Keep the latest onClose/dismissible in refs so the focus-management effect
  // below can depend ONLY on `isOpen`. If it depended on `onClose`, every parent
  // re-render (e.g. a keystroke in a form inside the dialog) would tear down and
  // re-run the effect — and its cleanup refocuses the previously-focused element,
  // yanking the caret out of whatever input you're typing in.
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);

    // Move focus into the dialog so keyboard users aren't left behind it
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="vx-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        className={`vx-dialog vx-dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vx-dialog-title"
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="vx-dialog__header">
          <div>
            <h2 id="vx-dialog-title" className="vx-dialog__title">{title}</h2>
            {description && <p className="vx-dialog__description">{description}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              className="vx-dialog__close"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </header>

        <div className="vx-dialog__body">{children}</div>

        {footer && <footer className="vx-dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
};

export default Dialog;
