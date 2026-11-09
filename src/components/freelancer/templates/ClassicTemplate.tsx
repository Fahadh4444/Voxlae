"use client";

/**
 * ClassicTemplate — the original professional, LinkedIn-style layout.
 *
 * This is the default template and the safe option. It is the profile page's
 * former inline body, moved out verbatim and driven by ProfileTemplateProps so it
 * sits alongside the artistic templates. Styles still live in the original
 * FreelancerPublicProfilePage.css (fpp__ classes).
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import ProfileStrengthCard from '../ProfileStrengthCard';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, ShareIcon } from './shared';
import '../../../styles/pages/FreelancerPublicProfilePage.css';

const ClassicTemplate: React.FC<ProfileTemplateProps> = ({
  profile, ownProfile, publicUrl, isOwner, firstName, rate, availability,
  hiddenProjects, coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => {
  const metaLine = [
    profile.location,
    profile.languages?.length ? profile.languages.slice(0, 3).join(', ') : null,
  ].filter(Boolean).join(' · ');

  const bannerStyle = coverImageUrl
    ? { backgroundImage: `url(${coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  return (
    <div className="fpp__layout">
      <main className="fpp__main">
        {/* ── Hero (banner → avatar → identity → actions) ── */}
        <section className="fpp__hero">
          <div className="fpp__banner" style={bannerStyle} aria-hidden="true" />

          <div className="fpp__hero-inner">
            <Avatar src={profile.avatarUrl} name={profile.name} size={104} className="fpp__avatar" />

            <h1 className="fpp__name">{profile.name}</h1>
            {profile.headline && <p className="fpp__headline">{profile.headline}</p>}
            {metaLine && <p className="fpp__meta">{metaLine}</p>}

            <div className="fpp__chips">
              <span className={`fpp__chip fpp__chip--${availability.toLowerCase()}`}>
                {AVAILABILITY_LABEL[availability]}
              </span>
              {rate && !profile.limited && <span className="fpp__chip">{rate}</span>}
              {profile.portfolioTotal > 0 && (
                <span className="fpp__chip fpp__chip--subtle">
                  {profile.portfolioTotal} {profile.portfolioTotal === 1 ? 'project' : 'projects'}
                </span>
              )}
            </div>

            <div className="fpp__hero-actions">
              {isOwner && (
                <button type="button" className="fpp__btn fpp__btn--primary fpp__btn--sm" onClick={onEdit}>
                  Edit profile
                </button>
              )}
              {!isOwner && contactHref && (
                <a className="fpp__btn fpp__btn--primary fpp__btn--sm" href={contactHref}>
                  Contact {firstName}
                </a>
              )}
              {!isOwner && profile.limited && (
                <button type="button" className="fpp__btn fpp__btn--primary fpp__btn--sm" onClick={onAuth}>
                  Sign in to contact
                </button>
              )}
              <button
                type="button"
                className="fpp__btn fpp__btn--outline fpp__btn--sm"
                onClick={onShare}
                aria-label="Share this profile"
              >
                <ShareIcon />
                <span>Share</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Portfolio ── */}
        {(profile.portfolioItems.length > 0 || hiddenProjects > 0) && (
          <section className="fpp__section">
            <h2 className="fpp__section-title">Portfolio</h2>
            <div className="fpp__portfolio">
              {profile.portfolioItems.map((item, i) => (
                <article key={i} className="fpp__project">
                  {item.thumbnailUrl && (
                    <img className="fpp__project-thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                  )}
                  <div className="fpp__project-body">
                    {(item.previewSite || hostOf(item.projectUrl)) && (
                      <span className="fpp__project-site">{item.previewSite || hostOf(item.projectUrl)}</span>
                    )}
                    <h3 className="fpp__project-title">{item.title}</h3>
                    {item.outcome && <p className="fpp__project-outcome">{item.outcome}</p>}
                    <div className="fpp__project-meta">
                      {item.role && <span className="fpp__chip fpp__chip--small">{item.role}</span>}
                      {item.projectUrl && (
                        <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="fpp__project-link">
                          View project ↗
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {profile.limited && hiddenProjects > 0 && (
                <button className="fpp__project fpp__project--locked" onClick={onAuth}>
                  <span className="fpp__lock" aria-hidden="true">🔒</span>
                  <span>
                    <b>{hiddenProjects} more {hiddenProjects === 1 ? 'project' : 'projects'}</b>
                    <br />Sign in to see the full portfolio
                  </span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── About ── */}
        {profile.bio && (
          <section className="fpp__section">
            <h2 className="fpp__section-title">About</h2>
            <p className="fpp__bio">{profile.bio}</p>
            {profile.limited && (
              <button className="fpp__inline-unlock" onClick={onAuth}>Sign in to read more</button>
            )}
          </section>
        )}

        {/* ── Skills / tools / languages ── */}
        {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
          <section className="fpp__section">
            <h2 className="fpp__section-title">Skills &amp; expertise</h2>

            {profile.skills.length > 0 && (
              <div className="fpp__group">
                <h3 className="fpp__group-title">Skills</h3>
                <div className="fpp__chips">
                  {profile.skills.map(s => <span key={s} className="fpp__chip">{s}</span>)}
                </div>
              </div>
            )}

            {profile.tools?.length > 0 && (
              <div className="fpp__group">
                <h3 className="fpp__group-title">Tools</h3>
                <div className="fpp__chips">
                  {profile.tools.map(t => <span key={t} className="fpp__chip fpp__chip--subtle">{t}</span>)}
                </div>
              </div>
            )}

            {profile.languages?.length > 0 && (
              <div className="fpp__group">
                <h3 className="fpp__group-title">Languages</h3>
                <div className="fpp__chips">
                  {profile.languages.map(l => <span key={l} className="fpp__chip fpp__chip--subtle">{l}</span>)}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Experience ── */}
        {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
          <section className="fpp__section">
            <h2 className="fpp__section-title">Experience</h2>
            {profile.limited ? (
              <button className="fpp__project fpp__project--locked fpp__project--wide" onClick={onAuth}>
                <span className="fpp__lock" aria-hidden="true">🔒</span>
                <span>
                  <b>{profile.experienceTotal} {profile.experienceTotal === 1 ? 'role' : 'roles'}</b>
                  <br />Sign in to view work history
                </span>
              </button>
            ) : (
              <ol className="fpp__timeline">
                {profile.experienceEntries.map((entry, i) => (
                  <li key={i} className="fpp__timeline-item">
                    <h3 className="fpp__timeline-title">{entry.title}</h3>
                    <p className="fpp__timeline-meta">
                      {entry.organization}
                      {(entry.startDate || entry.endDate) && (
                        <> · {entry.startDate?.slice(0, 7) || '—'} → {entry.endDate ? entry.endDate.slice(0, 7) : 'present'}</>
                      )}
                    </p>
                    {entry.description && <p className="fpp__timeline-desc">{entry.description}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </main>

      {/* ── Rail: owner strength card, or visitor contact card ── */}
      {isOwner ? (
        <aside className="fpp__rail">
          <ProfileStrengthCard
            profile={ownProfile}
            publicUrl={publicUrl}
            onEdit={onEdit}
            onShare={onShare}
          />
        </aside>
      ) : (
        <aside className="fpp__rail">
          <div className="fpp__rail-card">
            {profile.limited ? (
              <>
                <p className="fpp__rail-note">Sign in to Voxlae to contact {firstName} and see their rate.</p>
                <button className="fpp__btn fpp__btn--primary fpp__btn--block" onClick={onAuth}>
                  Sign in to contact
                </button>
              </>
            ) : (
              <>
                {rate && <p className="fpp__rate"><span>Starting at</span><b>{rate}</b></p>}
                {contactHref && (
                  <a className="fpp__btn fpp__btn--primary fpp__btn--block" href={contactHref}>
                    Contact {firstName}
                  </a>
                )}
                <p className="fpp__rail-note">Opens your email app — replies go directly to {firstName}.</p>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};

export default ClassicTemplate;
