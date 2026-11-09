"use client";

/**
 * Section — Page section wrapper with optional title and subtitle
 */

import React from 'react';
import './Section.css';

export interface SectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

const Section: React.FC<SectionProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <section className={`vx-section ${className}`}>
      {(title || action) && (
        <div className="vx-section__header">
          <div>
            {title && <h2 className="vx-section__title">{title}</h2>}
            {subtitle && <p className="vx-section__subtitle">{subtitle}</p>}
          </div>
          {action && <div className="vx-section__action">{action}</div>}
        </div>
      )}
      <div className="vx-section__body">{children}</div>
    </section>
  );
};

export default Section;
