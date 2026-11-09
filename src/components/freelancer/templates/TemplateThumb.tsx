"use client";

/**
 * TemplateThumb — a tiny CSS mock of each template's layout, shown on the picker
 * cards. Purely decorative (no real data), so it stays cheap and never breaks.
 * Styles live in FreelancerTemplatesPage.css under `.tt`.
 */

import React from 'react';
import { ProfileTemplateId } from '../../../api/types';

const bars = (n: number, cls = 'tt__bar') =>
  Array.from({ length: n }, (_, i) => <span key={i} className={cls} />);

const TemplateThumb: React.FC<{ id: ProfileTemplateId }> = ({ id }) => {
  switch (id) {
    case 'GALLERY':
      return (
        <div className="tt tt--gallery" aria-hidden="true">
          <div className="tt__topbar"><span className="tt__dot" /><span className="tt__bar tt__bar--wide" /></div>
          <div className="tt__grid">{bars(6, 'tt__cell')}</div>
        </div>
      );
    case 'EDITORIAL':
      return (
        <div className="tt tt--editorial" aria-hidden="true">
          <div className="tt__serif">Aa</div>
          <div className="tt__lines">{bars(3)}</div>
          <div className="tt__rule" />
          <div className="tt__row"><span className="tt__num">01</span><span className="tt__bar tt__bar--wide" /></div>
          <div className="tt__row"><span className="tt__num">02</span><span className="tt__bar tt__bar--wide" /></div>
        </div>
      );
    case 'SPOTLIGHT':
      return (
        <div className="tt tt--spotlight" aria-hidden="true">
          <div className="tt__glow" />
          <div className="tt__ring" />
          <div className="tt__bar tt__bar--center" />
          <div className="tt__cards">{bars(3, 'tt__card')}</div>
        </div>
      );
    case 'STUDIO':
      return (
        <div className="tt tt--studio" aria-hidden="true">
          <div className="tt__big" />
          <div className="tt__rule" />
          <div className="tt__split"><span className="tt__bar" /><span className="tt__bar tt__bar--wide" /></div>
        </div>
      );
    case 'INDEX':
      return (
        <div className="tt tt--index" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="tt__list-row"><span className="tt__num">0{i + 1}</span><span className="tt__bar tt__bar--wide" /></div>
          ))}
        </div>
      );
    case 'TERMINAL':
      return (
        <div className="tt tt--terminal" aria-hidden="true">
          <div className="tt__term-bar"><i /><i /><i /></div>
          <div className="tt__term-body">
            <span className="tt__term-line"><em>$</em> whoami</span>
            <span className="tt__term-line tt__term-out">aria_nakamura</span>
            <span className="tt__term-line"><em>$</em> ls ./work</span>
            <span className="tt__term-line tt__term-out">▸ 01_rebrand</span>
          </div>
        </div>
      );
    case 'BRUTALIST':
      return (
        <div className="tt tt--brutalist" aria-hidden="true">
          <span className="tt__bru-sticker" />
          <div className="tt__bru-box"><span className="tt__bru-title" /><span className="tt__bar" /></div>
          <div className="tt__bru-row"><span className="tt__bru-card" /><span className="tt__bru-card tt__bru-card--accent" /></div>
        </div>
      );
    case 'BENTO':
      return (
        <div className="tt tt--bento" aria-hidden="true">
          <span className="tt__bento-cell tt__bento-cell--id" />
          <span className="tt__bento-cell tt__bento-cell--accent" />
          <span className="tt__bento-cell" />
          <span className="tt__bento-cell tt__bento-cell--wide" />
          <span className="tt__bento-cell" />
        </div>
      );
    case 'CLASSIC':
    default:
      return (
        <div className="tt tt--classic" aria-hidden="true">
          <div className="tt__banner" />
          <div className="tt__avatar" />
          <div className="tt__lines">{bars(2)}</div>
          <div className="tt__grid tt__grid--2">{bars(2, 'tt__cell')}</div>
        </div>
      );
  }
};

export default TemplateThumb;
