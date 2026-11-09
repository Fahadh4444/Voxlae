"use client";

/**
 * BrutalistTemplate — loud neo-brutalism. Thick black borders, hard offset
 * shadows, oversized type, clashing accents, zero rounded corners. For creatives
 * who want the profile itself to shout: bold designers, illustrators, agencies.
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange } from './shared';
import '../../../styles/templates/brutalist.css';

const BrutalistTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => (
  <div className="tpl-bru">
    <div className="tpl-bru__page">
      {/* ── Hero ── */}
      <header className="tpl-bru__hero">
        <span className={`tpl-bru__sticker tpl-bru__sticker--${availability.toLowerCase()}`}>
          {AVAILABILITY_LABEL[availability]}
        </span>
        <div className="tpl-bru__hero-top">
          <Avatar src={profile.avatarUrl} name={profile.name} size={92} className="tpl-bru__avatar" />
          <div className="tpl-bru__hero-actions">
            {isOwner ? (
              <button className="tpl-bru__btn tpl-bru__btn--accent" onClick={onEdit}>EDIT ✎</button>
            ) : profile.limited ? (
              <button className="tpl-bru__btn tpl-bru__btn--accent" onClick={onAuth}>SIGN IN</button>
            ) : contactHref ? (
              <a className="tpl-bru__btn tpl-bru__btn--accent" href={contactHref}>HIRE {firstName.toUpperCase()}</a>
            ) : null}
            <button className="tpl-bru__btn" onClick={onShare}>SHARE ↗</button>
          </div>
        </div>
        <h1 className="tpl-bru__name">{profile.name}</h1>
        {profile.headline && <p className="tpl-bru__headline">{profile.headline}</p>}
        <div className="tpl-bru__facts">
          {profile.location && <span>◉ {profile.location}</span>}
          {rate && !profile.limited && <span>◉ {rate}</span>}
          {profile.portfolioTotal > 0 && <span>◉ {profile.portfolioTotal} {profile.portfolioTotal === 1 ? 'project' : 'projects'}</span>}
        </div>
      </header>

      {coverImageUrl && (
        <div className="tpl-bru__cover"><img src={coverImageUrl} alt="" loading="lazy" /></div>
      )}

      {/* ── Work ── */}
      {(profile.portfolioItems.length > 0 || hiddenProjects > 0) && (
        <section className="tpl-bru__section">
          <h2 className="tpl-bru__h2">WORK</h2>
          <div className="tpl-bru__grid">
            {profile.portfolioItems.map((item, i) => {
              const site = item.previewSite || hostOf(item.projectUrl);
              const inner = (
                <>
                  {item.thumbnailUrl
                    ? <img className="tpl-bru__thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                    : <div className="tpl-bru__thumb tpl-bru__thumb--empty">{String(i + 1).padStart(2, '0')}</div>}
                  <div className="tpl-bru__card-body">
                    <h3 className="tpl-bru__card-title">{item.title}</h3>
                    {item.outcome && <p className="tpl-bru__card-out">{item.outcome}</p>}
                    <div className="tpl-bru__card-meta">
                      {item.role && <span className="tpl-bru__chip">{item.role}</span>}
                      {site && <span className="tpl-bru__site">{site}{item.projectUrl ? ' ↗' : ''}</span>}
                    </div>
                  </div>
                </>
              );
              return item.projectUrl ? (
                <a key={i} className="tpl-bru__card" href={item.projectUrl} target="_blank" rel="noopener noreferrer">{inner}</a>
              ) : (
                <div key={i} className="tpl-bru__card">{inner}</div>
              );
            })}
            {profile.limited && hiddenProjects > 0 && (
              <button className="tpl-bru__card tpl-bru__card--locked" onClick={onAuth}>
                <span className="tpl-bru__lock">🔒</span>
                <b>+{hiddenProjects} MORE</b>
                <span>SIGN IN TO SEE ALL</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── About ── */}
      {profile.bio && (
        <section className="tpl-bru__section">
          <h2 className="tpl-bru__h2">ABOUT</h2>
          <div className="tpl-bru__box">
            <p className="tpl-bru__bio">{profile.bio}</p>
            {profile.limited && <button className="tpl-bru__more" onClick={onAuth}>READ MORE →</button>}
          </div>
        </section>
      )}

      {/* ── Skills ── */}
      {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
        <section className="tpl-bru__section">
          <h2 className="tpl-bru__h2">SKILLS</h2>
          <div className="tpl-bru__tags">
            {profile.skills.map(s => <span key={s} className="tpl-bru__tag">{s}</span>)}
            {profile.tools?.map(t => <span key={t} className="tpl-bru__tag tpl-bru__tag--alt">{t}</span>)}
            {profile.languages?.map(l => <span key={l} className="tpl-bru__tag tpl-bru__tag--ghost">{l}</span>)}
          </div>
        </section>
      )}

      {/* ── Experience ── */}
      {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
        <section className="tpl-bru__section">
          <h2 className="tpl-bru__h2">EXPERIENCE</h2>
          {profile.limited ? (
            <button className="tpl-bru__more" onClick={onAuth}>
              SIGN IN TO VIEW {profile.experienceTotal} {profile.experienceTotal === 1 ? 'ROLE' : 'ROLES'} →
            </button>
          ) : (
            <div className="tpl-bru__exp">
              {profile.experienceEntries.map((e, i) => (
                <div key={i} className="tpl-bru__exp-row">
                  <b>{e.title}</b>
                  <span>{[e.organization, experienceRange(e.startDate, e.endDate)].filter(Boolean).join(' · ')}</span>
                  {e.description && <p>{e.description}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Contact ── */}
      <footer className="tpl-bru__cta">
        <h2 className="tpl-bru__cta-title">LET'S<br />MAKE<br />SOMETHING.</h2>
        {profile.limited ? (
          <button className="tpl-bru__btn tpl-bru__btn--accent tpl-bru__btn--lg" onClick={onAuth}>SIGN IN TO CONTACT {firstName.toUpperCase()}</button>
        ) : contactHref ? (
          <a className="tpl-bru__btn tpl-bru__btn--accent tpl-bru__btn--lg" href={contactHref}>EMAIL {firstName.toUpperCase()} →</a>
        ) : null}
      </footer>
    </div>
  </div>
);

export default BrutalistTemplate;
