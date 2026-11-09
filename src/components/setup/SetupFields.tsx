"use client";

/**
 * SetupFields — small presentational field primitives for the setup wizards.
 *
 * These keep the role dialogs declarative: they describe *what* to collect
 * (option lists + selected value) and leave the markup/interaction here, so the
 * look stays identical across the influencer and brand flows.
 */

import React, { useState } from 'react';
import { OptionItem } from '../../data/profileOptions';

interface FieldProps {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}

/** Labelled field wrapper (matches setup-field spacing). */
export const SetupField: React.FC<FieldProps> = ({ label, hint, optional, children }) => (
  <div className="setup-field">
    <label className="setup-field__label">
      {label}
      {optional && <span className="setup-field__opt">optional</span>}
      {hint && <span className="setup-field__hint">{hint}</span>}
    </label>
    {children}
  </div>
);

interface ChoiceProps {
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
}

/** Single-select cards with an emoji icon + label (+ optional description). */
export const ChoiceCards: React.FC<ChoiceProps> = ({ options, value, onChange }) => (
  <div className="setup-choice-grid">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        className={`setup-choice ${opt.icon ? 'setup-choice--icon' : ''} ${value === opt.value ? 'is-selected' : ''}`}
        onClick={() => onChange(opt.value)}
      >
        {opt.icon && <span className="setup-choice__icon">{opt.icon}</span>}
        <span>
          <span className="setup-choice__title">{opt.label}</span>
          {opt.description && <span className="setup-choice__desc">{opt.description}</span>}
        </span>
      </button>
    ))}
  </div>
);

interface PillProps {
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
  /** Allow clicking the selected pill again to clear it. */
  clearable?: boolean;
  wrap?: boolean;
}

/** Single-select pill row (compact scales like experience / time commitment). */
export const PillGroup: React.FC<PillProps> = ({ options, value, onChange, clearable, wrap }) => (
  <div className={`setup-pill-row ${wrap ? 'setup-pill-row--wrap' : ''}`}>
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        className={`setup-pill ${value === opt.value ? 'is-selected' : ''}`}
        onClick={() => onChange(clearable && value === opt.value ? '' : opt.value)}
        title={opt.description}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

interface ChipProps {
  /** Preset options (label === stored value). */
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Cap the number of selections (e.g. skills up to 5). */
  max?: number;
  /** Allow typing a value that isn't in the preset list. */
  allowCustom?: boolean;
  customPlaceholder?: string;
}

/** Multi-select chips with an optional "add your own" input. */
export const ChipMultiSelect: React.FC<ChipProps> = ({
  options,
  selected,
  onToggle,
  max,
  allowCustom = false,
  customPlaceholder = 'Add your own…',
}) => {
  const [draft, setDraft] = useState('');
  const atMax = max !== undefined && selected.length >= max;

  // Show presets plus any custom values the user already picked, de-duplicated.
  const all = [...options];
  selected.forEach(s => {
    if (!all.some(o => o.toLowerCase() === s.toLowerCase())) all.push(s);
  });

  const addCustom = () => {
    const v = draft.trim();
    if (!v) return;
    const exists = selected.some(s => s.toLowerCase() === v.toLowerCase());
    if (!exists && !atMax) onToggle(v);
    setDraft('');
  };

  return (
    <>
      <div className="setup-chips">
        {all.map(opt => {
          const isOn = selected.some(s => s.toLowerCase() === opt.toLowerCase());
          return (
            <button
              key={opt}
              type="button"
              className={`setup-chip ${isOn ? 'is-selected' : ''}`}
              onClick={() => onToggle(opt)}
              disabled={!isOn && atMax}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {allowCustom && !atMax && (
        <div className="setup-chip-input">
          <input
            className="setup-chip-input__field"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 30))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder={customPlaceholder}
            maxLength={30}
          />
          <button
            type="button"
            className="setup-chip-input__add"
            onClick={addCustom}
            disabled={!draft.trim()}
            aria-label="Add"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {max !== undefined && selected.length > 0 && (
        <span className="setup-chip-count">{selected.length}/{max} selected</span>
      )}
    </>
  );
};
