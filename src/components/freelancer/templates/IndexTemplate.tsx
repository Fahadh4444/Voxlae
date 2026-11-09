"use client";

/**
 * IndexTemplate — a cargo.site-style index. Projects are a big type-driven list;
 * hovering a row floats its thumbnail beside the cursor. Grotesque/mono type,
 * almost no chrome. The signature "designed by a designer" portfolio look.
 *
 * Hover preview is pointer-only; on touch/mobile the thumbnails render inline.
 */

import React, { useRef, useState } from 'react';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange } from './shared';
import '../../../styles/templates/index-template.css';

const IndexTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => {
  const [active, setActive] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = previewRef.current;
    if (!el) return;
    el.style.transform = `translate(${e.clientX + 24}px, ${e.clientY - 90}px)`;
  };

  const num = (i: number) => String(i + 1).padStart(2, '0');
  const activeItem = active !== null ? profile.portfolioItems[active] : null;

  return (
    <div className="tpl-idx">
      {/* ── Header ── */}
      <header className="tpl-idx__head">
        <div className="tpl-idx__head-row">
          <h1 className="tpl-idx__name">{profile.name}</h1>
          <span className={`tpl-idx__avail tpl-idx__avail--${availability.toLowerCase()}`}>
            {AVAILABILITY_LABEL[availability]}
          </span>
        </div>
        {profile.headline && <p className="tpl-idx__headline">{profile.headline}</p>}
        <div className="tpl-idx__meta">
          {profile.location && <span>{profile.location}</span>}
          {rate && !profile.limited && <span>{rate}</span>}
          <span className="tpl-idx__meta-actions">
            {isOwner ? (
              <button onClick={onEdit}>[ edit ]</button>
            ) : contactHref ? (
              <a href={contactHref}>[ contact ]</a>
            ) : (
              <button onClick={onAuth}>[ sign in ]</button>
            )}
            <button onClick={onShare}>[ share ]</button>
          </span>
        </div>
      </header>

      {coverImageUrl && (
        <div className="tpl-idx__cover"><img src={coverImageUrl} alt="" loading="lazy" /></div>
      )}

      {/* ── Index of work ── */}
      {(profile.portfolioItems.length > 0 || hiddenProjects > 0) && (
        <section className="tpl-idx__section">
          <span className="tpl-idx__caption">Index — Selected Work</span>
          <ol className="tpl-idx__list" onMouseMove={onMove} onMouseLeave={() => setActive(null)}>
            {profile.portfolioItems.map((item, i) => {
              const site = item.previewSite || hostOf(item.projectUrl);
              const inner = (
                <>
                  <span className="tpl-idx__row-num">{num(i)}</span>
                  <span className="tpl-idx__row-title">{item.title}</span>
                  <span className="tpl-idx__row-tag">{[item.role, site].filter(Boolean).join(', ')}</span>
                  {item.thumbnailUrl && (
                    <img className="tpl-idx__row-thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                  )}
                </>
              );
              const common = {
                className: 'tpl-idx__row',
                onMouseEnter: () => setActive(i),
              };
              return (
                <li key={i}>
                  {item.projectUrl ? (
                    <a {...common} href={item.projectUrl} target="_blank" rel="noopener noreferrer">{inner}</a>
                  ) : (
                    <div {...common}>{inner}</div>
                  )}
                </li>
              );
            })}
            {profile.limited && hiddenProjects > 0 && (
              <li>
                <button className="tpl-idx__row tpl-idx__row--locked" onClick={onAuth}>
                  <span className="tpl-idx__row-num">+</span>
                  <span className="tpl-idx__row-title">{hiddenProjects} more — sign in to view</span>
                </button>
              </li>
            )}
          </ol>
        </section>
      )}

      {/* ── About ── */}
      {profile.bio && (
        <section className="tpl-idx__section">
          <span className="tpl-idx__caption">About</span>
          <p className="tpl-idx__bio">{profile.bio}</p>
          {profile.limited && <button className="tpl-idx__link" onClick={onAuth}>sign in to read more →</button>}
        </section>
      )}

      {/* ── Info ── */}
      {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
        <section className="tpl-idx__section">
          <span className="tpl-idx__caption">Info</span>
          <dl className="tpl-idx__info">
            {profile.skills.length > 0 && <><dt>Skills</dt><dd>{profile.skills.join(', ')}</dd></>}
            {profile.tools?.length > 0 && <><dt>Tools</dt><dd>{profile.tools.join(', ')}</dd></>}
            {profile.languages?.length > 0 && <><dt>Languages</dt><dd>{profile.languages.join(', ')}</dd></>}
          </dl>
        </section>
      )}

      {/* ── Experience ── */}
      {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
        <section className="tpl-idx__section">
          <span className="tpl-idx__caption">Experience</span>
          {profile.limited ? (
            <button className="tpl-idx__link" onClick={onAuth}>
              sign in to view {profile.experienceTotal} {profile.experienceTotal === 1 ? 'role' : 'roles'} →
            </button>
          ) : (
            <dl className="tpl-idx__info">
              {profile.experienceEntries.map((e, i) => (
                <React.Fragment key={i}>
                  <dt>{experienceRange(e.startDate, e.endDate) || '—'}</dt>
                  <dd>{e.title}{e.organization && `, ${e.organization}`}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </section>
      )}

      {/* ── Contact ── */}
      <footer className="tpl-idx__foot">
        {profile.limited ? (
          <button className="tpl-idx__big-link" onClick={onAuth}>Sign in to contact {firstName} →</button>
        ) : contactHref ? (
          <a className="tpl-idx__big-link" href={contactHref}>Contact {firstName} →</a>
        ) : null}
      </footer>

      {/* ── Floating hover preview (pointer only) ── */}
      <div
        ref={previewRef}
        className={`tpl-idx__preview ${activeItem?.thumbnailUrl ? 'is-on' : ''}`}
        aria-hidden="true"
      >
        {activeItem?.thumbnailUrl && <img src={activeItem.thumbnailUrl} alt="" />}
      </div>
    </div>
  );
};

export default IndexTemplate;
