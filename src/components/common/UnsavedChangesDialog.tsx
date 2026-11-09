"use client";

/**
 * UnsavedChangesDialog
 *
 * Branded confirmation dialog shown when the user tries to navigate away
 * from a page with unsaved form changes.
 *
 * Rendered into document.body via a Portal so z-index stacking is clean
 * regardless of where in the component tree it is placed.
 *
 * Props:
 *   onConfirm — user chose to leave (discard changes)
 *   onCancel  — user chose to stay
 */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import Button from './Button';
import '../../styles/components/UnsavedChangesDialog.css';

interface UnsavedChangesDialogProps {
  onConfirm: () => void;
  onCancel:  () => void;
}

const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({ onConfirm, onCancel }) => {
  // Close on Escape key
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onCancel]);

  return ReactDOM.createPortal(
    <div
      className="ucd-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="ucd-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ucd-title"
        aria-describedby="ucd-body"
      >
        {/* Icon */}
        <div className="ucd-icon-wrap" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h3 id="ucd-title" className="ucd-title">Unsaved Changes</h3>

        <p id="ucd-body" className="ucd-body">
          You have unsaved changes that will be lost if you leave this page.
          <br />
          Do you want to continue?
        </p>

        <div className="ucd-actions">
          <Button variant="ghost" onClick={onCancel}>
            Keep Editing
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Leave
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UnsavedChangesDialog;
