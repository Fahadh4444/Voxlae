"use client";

/**
 * SelectWithCustom — a dropdown of presets with "Custom…" pinned at the top.
 *
 * Presets cover the common cases in one tap; "Custom…" swaps in a free input
 * for anyone whose number isn't on the ladder. Picking a value that isn't in
 * the preset list (e.g. loading a saved custom rate) automatically shows the
 * custom input, so the field always reflects the real stored value.
 */

import React, { useEffect, useState } from 'react';
import '../../styles/components/SelectWithCustom.css';

const CUSTOM = '__custom__';

interface SelectWithCustomProps {
  label: string;
  /** Current value; '' when unset. */
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** Input type for the custom field. */
  customType?: 'text' | 'number';
  customPlaceholder?: string;
  hint?: string;
  id?: string;
}

const SelectWithCustom: React.FC<SelectWithCustomProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  customType = 'text',
  customPlaceholder = 'Enter a value',
  hint,
  id,
}) => {
  const fieldId = id || `select-custom-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const isPreset = (v: string) => options.some(o => o.value === v);
  // A stored value that isn't a preset must be a custom one — reveal the input
  const [custom, setCustom] = useState(() => !!value && !isPreset(value));

  useEffect(() => {
    if (value && !isPreset(value)) setCustom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  const handleSelect = (next: string) => {
    if (next === CUSTOM) {
      setCustom(true);
      onChange(''); // clear so the user types their own
      return;
    }
    setCustom(false);
    onChange(next);
  };

  return (
    <div className="vx-select-custom">
      <label className="vx-select-custom__label" htmlFor={fieldId}>{label}</label>

      {custom ? (
        <div className="vx-select-custom__custom-row">
          <input
            id={fieldId}
            className="vx-select-custom__field"
            type={customType}
            inputMode={customType === 'number' ? 'decimal' : undefined}
            min={customType === 'number' ? 0 : undefined}
            value={value}
            placeholder={customPlaceholder}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="vx-select-custom__back"
            onClick={() => { setCustom(false); onChange(''); }}
          >
            Use presets
          </button>
        </div>
      ) : (
        <select
          id={fieldId}
          className="vx-select-custom__field"
          value={isPreset(value) ? value : ''}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {/* Pinned to the top so it's found without scrolling the whole ladder */}
          <option value={CUSTOM}>✏️ Custom…</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {hint && <p className="vx-select-custom__hint">{hint}</p>}
    </div>
  );
};

export default SelectWithCustom;
