"use client";

/**
 * Autocomplete — single-value text input with suggestions.
 *
 * Used for Location. Free text is always allowed, so a town that isn't in our
 * list still works — the suggestions just save typing for the common cases.
 */

import React, { useMemo, useState } from 'react';
import '../../styles/components/Autocomplete.css';

interface AutocompleteProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  id?: string;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  hint,
  maxLength = 120,
  id,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputId = id || `autocomplete-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 6); // show popular options on focus
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 6);
  }, [value, suggestions]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setActiveIndex(i => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) {
      e.preventDefault();
      select(matches[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="vx-autocomplete">
      <label className="vx-autocomplete__label" htmlFor={inputId}>{label}</label>

      <input
        id={inputId}
        className="vx-autocomplete__field"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={`${inputId}-listbox`}
      />

      {open && matches.length > 0 && (
        <ul className="vx-autocomplete__suggestions" id={`${inputId}-listbox`} role="listbox">
          {matches.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={i === activeIndex ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="vx-autocomplete__hint">{hint}</p>}
    </div>
  );
};

export default Autocomplete;
