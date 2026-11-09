"use client";

/**
 * TagInput — multi-value chip input with suggestions.
 *
 * Used for skills, tools and languages. Suggestions are a convenience, never a
 * constraint: anything typed is accepted, so a freelancer with an unusual tool
 * or language is never blocked by our list being incomplete.
 */

import React, { useMemo, useRef, useState } from 'react';
import '../../styles/components/TagInput.css';

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  /** Cap; the input disables itself once reached. */
  max?: number;
  hint?: string;
  id?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Type and press Enter',
  max = 20,
  hint,
  id,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id || `tag-input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const atLimit = value.length >= max;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter(s => s.toLowerCase().includes(q) && !value.includes(s))
      .slice(0, 6);
  }, [query, suggestions, value]);

  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag || atLimit) return;
    // Case-insensitive dedupe — "Figma" and "figma" are the same tool
    if (value.some(v => v.toLowerCase() === tag.toLowerCase())) {
      setQuery('');
      return;
    }
    onChange([...value, tag]);
    setQuery('');
    setActiveIndex(-1);
    setOpen(false);
  };

  const remove = (tag: string) => onChange(value.filter(v => v !== tag));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add(activeIndex >= 0 && matches[activeIndex] ? matches[activeIndex] : query);
    } else if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setActiveIndex(i => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && value.length) {
      // Backspace on an empty field removes the last chip — standard chip behaviour
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="vx-tag-input">
      <label className="vx-tag-input__label" htmlFor={inputId}>
        {label}
        <span className="vx-tag-input__count">{value.length}/{max}</span>
      </label>

      <div className="vx-tag-input__box" onClick={() => inputRef.current?.focus()}>
        {value.map(tag => (
          <span key={tag} className="vx-tag-input__chip">
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(tag); }}
              aria-label={`Remove ${tag}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}

        <input
          id={inputId}
          ref={inputRef}
          className="vx-tag-input__field"
          value={query}
          disabled={atLimit}
          placeholder={atLimit ? `Maximum ${max} reached` : placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)} // let a click land first
          autoComplete="off"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={`${inputId}-listbox`}
        />
      </div>

      {open && matches.length > 0 && (
        <ul className="vx-tag-input__suggestions" id={`${inputId}-listbox`} role="listbox">
          {matches.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={i === activeIndex ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="vx-tag-input__hint">{hint}</p>}
    </div>
  );
};

export default TagInput;
