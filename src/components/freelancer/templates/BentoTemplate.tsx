"use client";

/**
 * BentoTemplate — a rounded bento-box mosaic. Identity, availability, work, skills
 * and contact each live in their own soft card of varying size, tiled into a grid.
 * The modern "everything at a glance" portfolio. For product designers & multi-hyphenates.
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange, ShareIcon } from './shared';
import '../../../styles/templates/bento.css';

const BentoTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => (
  <div className="tpl-bento">
    <div className="tpl-bento__grid">
      {/* Identity */}
      <section className="tpl-bento__cell tpl-bento__cell--id" style={coverImageUrl ? { backgroundImage: `linear-gradient(180deg, rgba(10,14,26,0.15), rgba(10,14,26,0.82)), url(${coverImageUrl})` } : undefined}>
        <div className="tpl-bento__id-top">
          <Avatar src={profile.avatarUrl} name={profile.name} size={76} className="tpl-bento__avatar" />
          <button className="tpl-bento__icon" onClick={onShare} aria-label="Share profile"><ShareIcon /></button>
        </div>
        <h1 className="tpl-bento__name">{profile.name}</h1>
        {profile.headline && <p className="tpl-bento__headline">{profile.headline}</p>}
        {profile.location && <p className="tpl-bento__loc">📍 {profile.location}</p>}
      </section>

      {/* Availability */}
      <section className={`tpl-bento__cell tpl-bento__cell--status tpl-bento__cell--${availability.toLowerCase()}`}>
        <span className="tpl-bento__pulse" aria-hidden="true" />
        <span className="tpl-bento__status-label">{AVAILABILITY_LABEL[availability]}</span>
        {rate && !profile.limited && <span className="tpl-bento__rate">{rate}</span>}
      </section>

      {/* Contact */}
      <section className="tpl-bento__cell tpl-bento__cell--contact">
        <span className="tpl-bento__contact-k">Want to work together?</span>
        {isOwner ? (
          <button className="tpl-bento__cta" onClick={onEdit}>Edit profile</button>
        ) : profile.limited ? (
          <button className="tpl-bento__cta" onClick={onAuth}>Sign in to contact</button>
        ) : contactHref ? (
          <a className="tpl-bento__cta" href={contactHref}>Contact {firstName} →</a>
        ) : null}
      </section>

      {/* About */}
      {profile.bio && (
        <section className="tpl-bento__cell tpl-bento__cell--about">
          <span className="tpl-bento__k">About</span>
          <p className="tpl-bento__bio">{profile.bio}</p>
          {profile.limited && <button className="tpl-bento__link" onClick={onAuth}>Read more →</button>}
        </section>
      )}

      {/* Work */}
      {profile.portfolioItems.map((item, i) => {
        const site = item.previewSite || hostOf(item.projectUrl);
        const inner = (
          <>
            {item.thumbnailUrl
              ? <img className="tpl-bento__work-thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
              : <div className="tpl-bento__work-thumb tpl-bento__work-thumb--empty" aria-hidden="true" />}
            <div className="tpl-bento__work-body">
              {site && <span className="tpl-bento__work-site">{site}</span>}
              <h3 className="tpl-bento__work-title">{item.title}</h3>
              {item.outcome && <p className="tpl-bento__work-out">{item.outcome}</p>}
              {item.role && <span className="tpl-bento__pill">{item.role}</span>}
            </div>
          </>
        );
        return (
          <article key={i} className={`tpl-bento__cell tpl-bento__cell--work ${i === 0 ? 'tpl-bento__cell--work-lg' : ''}`}>
            {item.projectUrl
              ? <a className="tpl-bento__work-link" href={item.projectUrl} target="_blank" rel="noopener noreferrer">{inner}</a>
              : inner}
          </article>
        );
      })}
      {profile.limited && hiddenProjects > 0 && (
        <button className="tpl-bento__cell tpl-bento__cell--work tpl-bento__cell--locked" onClick={onAuth}>
          <span className="tpl-bento__lock" aria-hidden="true">🔒</span>
          <b>+{hiddenProjects} more</b>
          <span>Sign in to see everything</span>
        </button>
      )}

      {/* Skills */}
      {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
        <section className="tpl-bento__cell tpl-bento__cell--skills">
          <span className="tpl-bento__k">Skills &amp; tools</span>
          <div className="tpl-bento__tags">
            {profile.skills.map(s => <span key={s} className="tpl-bento__tag">{s}</span>)}
            {profile.tools?.map(t => <span key={t} className="tpl-bento__tag tpl-bento__tag--ghost">{t}</span>)}
            {profile.languages?.map(l => <span key={l} className="tpl-bento__tag tpl-bento__tag--ghost">{l}</span>)}
          </div>
        </section>
      )}

      {/* Experience */}
      {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
        <section className="tpl-bento__cell tpl-bento__cell--exp">
          <span className="tpl-bento__k">Experience</span>
          {profile.limited ? (
            <button className="tpl-bento__link" onClick={onAuth}>
              Sign in to view {profile.experienceTotal} {profile.experienceTotal === 1 ? 'role' : 'roles'} →
            </button>
          ) : (
            <ul className="tpl-bento__exp">
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
  </div>
);

export default BentoTemplate;
