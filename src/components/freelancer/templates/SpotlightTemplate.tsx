"use client";

/**
 * SpotlightTemplate — an immersive dark stage. Cover image bleeds behind a
 * gradient glow, glassmorphism cards, and a subtle staggered entrance. For work
 * that looks best in the dark: motion & video editors, game and music creators.
 *
 * The entrance is pure CSS (see spotlight.css) so content is never trapped behind
 * a JS animation — it always resolves to visible, and reduced-motion turns it off.
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange, ShareIcon } from './shared';
import '../../../styles/templates/spotlight.css';

const SpotlightTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => (
  <div className="tpl-spot">
    <div className="tpl-spot__aura" aria-hidden="true" />
    {coverImageUrl && (
      <div className="tpl-spot__cover" style={{ backgroundImage: `url(${coverImageUrl})` }} aria-hidden="true" />
    )}

    <div className="tpl-spot__inner">
      {/* ── Hero ── */}
      <header className="tpl-spot__hero tpl-spot__rise">
        <div className="tpl-spot__avatar-ring">
          <Avatar src={profile.avatarUrl} name={profile.name} size={96} className="tpl-spot__avatar" />
        </div>
        <span className={`tpl-spot__status tpl-spot__status--${availability.toLowerCase()}`}>
          {AVAILABILITY_LABEL[availability]}
        </span>
        <h1 className="tpl-spot__name">{profile.name}</h1>
        {profile.headline && <p className="tpl-spot__headline">{profile.headline}</p>}
        {profile.location && <p className="tpl-spot__loc">{profile.location}</p>}

        <div className="tpl-spot__actions">
          {isOwner ? (
            <button className="tpl-spot__btn tpl-spot__btn--glow" onClick={onEdit}>Edit profile</button>
          ) : contactHref ? (
            <a className="tpl-spot__btn tpl-spot__btn--glow" href={contactHref}>Contact {firstName}</a>
          ) : (
            <button className="tpl-spot__btn tpl-spot__btn--glow" onClick={onAuth}>Sign in to contact</button>
          )}
          <button className="tpl-spot__btn tpl-spot__btn--glass" onClick={onShare} aria-label="Share profile">
            <ShareIcon /> Share
          </button>
        </div>
      </header>

      {/* ── Work ── */}
      {(profile.portfolioItems.length > 0 || hiddenProjects > 0) && (
        <section className="tpl-spot__section">
          <h2 className="tpl-spot__h2">Work</h2>
          <div className="tpl-spot__grid">
            {profile.portfolioItems.map((item, i) => {
              const site = item.previewSite || hostOf(item.projectUrl);
              const inner = (
                <>
                  {item.thumbnailUrl
                    ? <img className="tpl-spot__thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                    : <div className="tpl-spot__thumb tpl-spot__thumb--empty" aria-hidden="true" />}
                  <div className="tpl-spot__card-body">
                    {site && <span className="tpl-spot__card-site">{site}</span>}
                    <h3 className="tpl-spot__card-title">{item.title}</h3>
                    {item.outcome && <p className="tpl-spot__card-outcome">{item.outcome}</p>}
                    {item.role && <span className="tpl-spot__card-role">{item.role}</span>}
                  </div>
                </>
              );
              return (
                <div key={i} className="tpl-spot__card tpl-spot__rise" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}>
                  {item.projectUrl
                    ? <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="tpl-spot__card-link">{inner}</a>
                    : inner}
                </div>
              );
            })}
            {profile.limited && hiddenProjects > 0 && (
              <button className="tpl-spot__card tpl-spot__card--locked" onClick={onAuth}>
                <span className="tpl-spot__lock" aria-hidden="true">🔒</span>
                <b>{hiddenProjects} more {hiddenProjects === 1 ? 'project' : 'projects'}</b>
                <span>Sign in to see everything</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── About ── */}
      {profile.bio && (
        <section className="tpl-spot__section">
          <h2 className="tpl-spot__h2">About</h2>
          <p className="tpl-spot__bio">{profile.bio}</p>
          {profile.limited && <button className="tpl-spot__more" onClick={onAuth}>Sign in to read more</button>}
        </section>
      )}

      {/* ── Skills ── */}
      {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
        <section className="tpl-spot__section">
          <h2 className="tpl-spot__h2">Skills &amp; tools</h2>
          <div className="tpl-spot__tags">
            {profile.skills.map(s => <span key={s} className="tpl-spot__tag">{s}</span>)}
            {profile.tools?.map(t => <span key={t} className="tpl-spot__tag tpl-spot__tag--ghost">{t}</span>)}
            {profile.languages?.map(l => <span key={l} className="tpl-spot__tag tpl-spot__tag--ghost">{l}</span>)}
          </div>
        </section>
      )}

      {/* ── Experience ── */}
      {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
        <section className="tpl-spot__section">
          <h2 className="tpl-spot__h2">Experience</h2>
          {profile.limited ? (
            <button className="tpl-spot__more" onClick={onAuth}>
              Sign in to view {profile.experienceTotal} {profile.experienceTotal === 1 ? 'role' : 'roles'}
            </button>
          ) : (
            <ul className="tpl-spot__exp">
              {profile.experienceEntries.map((e, i) => (
                <li key={i}>
                  <div><b>{e.title}</b>{e.organization && <span> · {e.organization}</span>}</div>
                  <span className="tpl-spot__exp-when">{experienceRange(e.startDate, e.endDate)}</span>
                  {e.description && <p>{e.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Contact ── */}
      <footer className="tpl-spot__cta">
        {rate && !profile.limited && <p className="tpl-spot__rate">Starting at <b>{rate}</b></p>}
        {profile.limited ? (
          <button className="tpl-spot__btn tpl-spot__btn--glow tpl-spot__btn--lg" onClick={onAuth}>Sign in to contact {firstName}</button>
        ) : contactHref ? (
          <a className="tpl-spot__btn tpl-spot__btn--glow tpl-spot__btn--lg" href={contactHref}>Contact {firstName}</a>
        ) : null}
      </footer>
    </div>
  </div>
);

export default SpotlightTemplate;
