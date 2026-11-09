"use client";

/**
 * SetupWizard — a reusable, blocking, multi-step wizard shell.
 *
 * Wraps the shared Dialog (non-dismissible) and handles step navigation, the
 * progress bar, and the Back/Next/Finish footer. Role setup dialogs (influencer,
 * brand) just hand it a list of steps — the chrome and flow are identical, which
 * is what makes onboarding feel consistent across roles.
 */

import React, { useEffect, useState } from 'react';
import Dialog from '../common/Dialog';
import Button from '../common/Button';
import '../../styles/components/SetupWizard.css';

export interface WizardStep {
  /** Short label shown in the step header. */
  title: string;
  /** One-line helper under the title. */
  subtitle?: string;
  content: React.ReactNode;
  /** Gate the Next/Finish button until the step's required fields are filled. */
  canProceed: boolean;
  /**
   * Shown when the user tries to advance before the step is valid. Defaults to a
   * generic "fill in the required fields" message; set it to name what's missing.
   */
  requiredHint?: string;
}

interface SetupWizardProps {
  title: string;
  description?: string;
  steps: WizardStep[];
  submitting: boolean;
  /** Called on the final step's Finish. */
  onFinish: () => void;
  finishLabel?: string;
}

const SetupWizard: React.FC<SetupWizardProps> = ({
  title,
  description,
  steps,
  submitting,
  onFinish,
  finishLabel = 'Finish',
}) => {
  const [index, setIndex] = useState(0);
  const [showError, setShowError] = useState(false);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Clear the "please fill in…" message the moment the step becomes valid, so it
  // never lingers after the user fixes what was missing.
  useEffect(() => {
    if (step.canProceed) setShowError(false);
  }, [step.canProceed]);

  const next = () => {
    if (!step.canProceed) {
      // Don't silently no-op: tell the user what's blocking them.
      setShowError(true);
      return;
    }
    setShowError(false);
    if (isLast) onFinish();
    else setIndex(i => Math.min(i + 1, steps.length - 1));
  };

  const back = () => {
    setShowError(false);
    setIndex(i => Math.max(i - 1, 0));
  };

  return (
    <Dialog
      isOpen
      onClose={() => {}}
      dismissible={false}
      title={title}
      description={description}
      footer={
        <div className="setup-wizard__footer">
          <span className="setup-wizard__count">Step {index + 1} of {steps.length}</span>
          <div className="setup-wizard__actions">
            {index > 0 && (
              <Button variant="ghost" onClick={back} disabled={submitting}>
                Back
              </Button>
            )}
            {/* Intentionally NOT disabled on `!canProceed` — clicking an invalid
                step surfaces the error below instead of doing nothing. */}
            <Button variant="primary" onClick={next} disabled={submitting}>
              {submitting ? 'Saving…' : isLast ? finishLabel : 'Continue'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Progress bar */}
      <div className="setup-wizard__progress" aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} className={`setup-wizard__bar ${i <= index ? 'is-done' : ''}`} />
        ))}
      </div>

      <div className="setup-wizard__step">
        <h3 className="setup-wizard__step-title">{step.title}</h3>
        {step.subtitle && <p className="setup-wizard__step-subtitle">{step.subtitle}</p>}
        <div className="setup-wizard__step-body">{step.content}</div>

        {showError && !step.canProceed && (
          <p className="setup-wizard__error" role="alert">
            {step.requiredHint || 'Please fill in the required fields to continue.'}
          </p>
        )}
      </div>
    </Dialog>
  );
};

export default SetupWizard;
