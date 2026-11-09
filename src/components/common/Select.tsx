"use client";

/**
 * Select — Reusable dropdown select
 */

import React from 'react';
import '../../styles/components/Select.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder = 'Select an option',
  fullWidth = true,
  id,
  className = '',
  ...rest
}) => {
  const selectId = id || `vx-select-${label?.replace(/\s/g, '-').toLowerCase()}`;

  return (
    <div className={`vx-select-group ${fullWidth ? 'vx-select-group--full' : ''} ${className}`}>
      {label && (
        <label htmlFor={selectId} className="vx-select-label">
          {label}
        </label>
      )}
      <div className="vx-select-wrapper">
        <select
          id={selectId}
          className={`vx-select ${error ? 'vx-select--error' : ''}`}
          {...rest}
        >
          <option value="">{placeholder}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="vx-select-chevron">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
      {error && <span className="vx-select-error">{error}</span>}
    </div>
  );
};

export default Select;
