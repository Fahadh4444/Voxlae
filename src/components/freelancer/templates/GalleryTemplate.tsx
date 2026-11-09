"use client";

/**
 * GalleryTemplate — portfolio-first. The work fills the screen edge-to-edge; the
 * identity is a slim, sticky header. Built for visual creatives whose thumbnails
 * do the selling (designers, photographers, illustrators, 3D artists).
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange, ShareIcon } from './shared';
import '../../../styles/templates/gallery.css';

const GalleryTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => {
  const hasWork = profile.portfolioItems.length > 0 || hiddenProjects > 0;

  return (
    <div className="tpl-gal">
      {/* ── Sticky identity header ── */}
      <header className="tpl-gal__bar">
        <div className="tpl-gal__id">
          <Avatar src={profile.avatarUrl} name={profile.name} size={44} className="tpl-gal__avatar" />
          <div>
            <h1 className="tpl-gal__name">{profile.name}</h1>
            {profile.headline && <p className="tpl-gal__headline">{profile.headline}</p>}
          </div>
        </div>
        <div className="tpl-gal__bar-actions">
          <span className={`tpl-gal__status tpl-gal__status--${availability.toLowerCase()}`}>
            {AVAILABILITY_LABEL[availability]}
          </span>
          {isOwner ? (
            <button className="tpl-gal__btn tpl-gal__btn--solid" onClick={onEdit}>Edit</button>
          ) : contactHref ? (
            <a className="tpl-gal__btn tpl-gal__btn--solid" href={contactHref}>Contact {firstName}</a>
          ) : (
            <button className="tpl-gal__btn tpl-gal__btn--solid" onClick={onAuth}>Sign in to contact</button>
          )}
          <button className="tpl-gal__btn tpl-gal__btn--icon" onClick={onShare} aria-label="Share profile">
            <ShareIcon />
          </button>
        </div>
      </header>

      {/* ── Optional cover strip ── */}
      {coverImageUrl && (
        <div className="tpl-gal__cover" style={{ backgroundImage: `url(${coverImageUrl})` }} aria-hidden="true" />
      )}

      {/* ── The gallery — the whole point of this template ── */}
      {hasWork ? (
        <div className="tpl-gal__grid">
          {profile.portfolioItems.map((item, i) => {
            const site = item.previewSite || hostOf(item.projectUrl);
            const inner = (
              <>
                {item.thumbnailUrl
                  ? <img className="tpl-gal__thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                  : <div className="tpl-gal__thumb tpl-gal__thumb--empty" aria-hidden="true"><span>{item.title}</span></div>}
                <div className="tpl-gal__overlay">
                  {site && <span className="tpl-gal__tile-site">{site}</span>}
                  <h3 className="tpl-gal__tile-title">{item.title}</h3>
                  {item.outcome && <p className="tpl-gal__tile-outcome">{item.outcome}</p>}
                  {item.role && <span className="tpl-gal__tile-role">{item.role}</span>}
                </div>
              </>
            );
            return item.projectUrl ? (
              <a key={i} className="tpl-gal__tile" href={item.projectUrl} target="_blank" rel="noopener noreferrer">{inner}</a>
            ) : (
              <div key={i} className="tpl-gal__tile">{inner}</div>
            );
          })}

          {profile.limited && hiddenProjects > 0 && (
            <button className="tpl-gal__tile tpl-gal__tile--locked" onClick={onAuth}>
              <span className="tpl-gal__lock" aria-hidden="true">🔒</span>
              <b>{hiddenProjects} more {hiddenProjects === 1 ? 'project' : 'projects'}</b>
              <span>Sign in to see the full gallery</span>
            </button>
          )}
        </div>
      ) : (
        <div className="tpl-gal__empty">No work added yet.</div>
      )}

      {/* ── Details below the fold ── */}
      <div className="tpl-gal__details">
        {profile.bio && (
          <section className="tpl-gal__about">
            <h2 className="tpl-gal__h2">About</h2>
            <p className="tpl-gal__bio">{profile.bio}</p>
            {profile.limited && <button className="tpl-gal__link" onClick={onAuth}>Sign in to read more</button>}
          </section>
        )}

        <div className="tpl-gal__cols">
          {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
            <section>
              <h2 className="tpl-gal__h2">Skills</h2>
              <div className="tpl-gal__tags">
                {profile.skills.map(s => <span key={s} className="tpl-gal__tag">{s}</span>)}
                {profile.tools?.map(t => <span key={t} className="tpl-gal__tag tpl-gal__tag--ghost">{t}</span>)}
                {profile.languages?.map(l => <span key={l} className="tpl-gal__tag tpl-gal__tag--ghost">{l}</span>)}
              </div>
            </section>
          )}

          {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
            <section>
              <h2 className="tpl-gal__h2">Experience</h2>
              {profile.limited ? (
                <button className="tpl-gal__link" onClick={onAuth}>
                  Sign in to view {profile.experienceTotal} {profile.experienceTotal === 1 ? 'role' : 'roles'}
                </button>
              ) : (
                <ul className="tpl-gal__exp">
                  {profile.experienceEntries.map((e, i) => (
                    <li key={i}>
                      <b>{e.title}</b>
                      <span>{[e.organization, experienceRange(e.startDate, e.endDate)].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* ── Contact footer ── */}
        <footer className="tpl-gal__cta">
          {profile.limited ? (
            <button className="tpl-gal__btn tpl-gal__btn--solid tpl-gal__btn--lg" onClick={onAuth}>Sign in to contact {firstName}</button>
          ) : contactHref ? (
            <>
              {rate && <p className="tpl-gal__rate">Starting at <b>{rate}</b></p>}
              <a className="tpl-gal__btn tpl-gal__btn--solid tpl-gal__btn--lg" href={contactHref}>Contact {firstName}</a>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

export default GalleryTemplate;
