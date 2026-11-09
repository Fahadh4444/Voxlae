"use client";

/**
 * EditorialTemplate — a magazine spread. Oversized display-serif name, an
 * asymmetric masthead, a pull-quote bio and a numbered project list. For people
 * who sell taste: art directors, writers, brand designers.
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange, ShareIcon } from './shared';
import '../../../styles/templates/editorial.css';

const EditorialTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => {
  const num = (i: number) => String(i + 1).padStart(2, '0');

  return (
    <div className="tpl-ed">
      <div className="tpl-ed__page">
        {/* ── Masthead ── */}
        <header className="tpl-ed__masthead">
          <div className="tpl-ed__kicker">
            <span className={`tpl-ed__dot tpl-ed__dot--${availability.toLowerCase()}`} />
            {AVAILABILITY_LABEL[availability]}
            {profile.location && <> — {profile.location}</>}
          </div>
          <h1 className="tpl-ed__name">{profile.name}</h1>
          {profile.headline && <p className="tpl-ed__deck">{profile.headline}</p>}

          <div className="tpl-ed__byline">
            <Avatar src={profile.avatarUrl} name={profile.name} size={52} className="tpl-ed__avatar" />
            <div className="tpl-ed__actions">
              {isOwner ? (
                <button className="tpl-ed__btn" onClick={onEdit}>Edit profile</button>
              ) : contactHref ? (
                <a className="tpl-ed__btn" href={contactHref}>Contact {firstName}</a>
              ) : (
                <button className="tpl-ed__btn" onClick={onAuth}>Sign in to contact</button>
              )}
              <button className="tpl-ed__btn tpl-ed__btn--ghost" onClick={onShare} aria-label="Share profile">
                <ShareIcon /> Share
              </button>
            </div>
          </div>
        </header>

        {coverImageUrl && (
          <figure className="tpl-ed__lead">
            <img src={coverImageUrl} alt="" loading="lazy" />
          </figure>
        )}

        {/* ── Pull-quote bio ── */}
        {profile.bio && (
          <section className="tpl-ed__lede">
            <p className="tpl-ed__bio">{profile.bio}</p>
            {profile.limited && <button className="tpl-ed__more" onClick={onAuth}>Continue reading →</button>}
          </section>
        )}

        {/* ── Selected work ── */}
        {(profile.portfolioItems.length > 0 || hiddenProjects > 0) && (
          <section className="tpl-ed__section">
            <h2 className="tpl-ed__label">Selected Work</h2>
            <ol className="tpl-ed__works">
              {profile.portfolioItems.map((item, i) => {
                const site = item.previewSite || hostOf(item.projectUrl);
                return (
                  <li key={i} className="tpl-ed__work">
                    <span className="tpl-ed__work-num">{num(i)}</span>
                    <div className="tpl-ed__work-body">
                      {site && <span className="tpl-ed__work-site">{site}</span>}
                      <h3 className="tpl-ed__work-title">{item.title}</h3>
                      {item.outcome && <p className="tpl-ed__work-outcome">{item.outcome}</p>}
                      <div className="tpl-ed__work-meta">
                        {item.role && <span>{item.role}</span>}
                        {item.projectUrl && (
                          <a href={item.projectUrl} target="_blank" rel="noopener noreferrer">View ↗</a>
                        )}
                      </div>
                    </div>
                    {item.thumbnailUrl && (
                      <img className="tpl-ed__work-thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                    )}
                  </li>
                );
              })}
            </ol>
            {profile.limited && hiddenProjects > 0 && (
              <button className="tpl-ed__more" onClick={onAuth}>
                Sign in to read {hiddenProjects} more {hiddenProjects === 1 ? 'piece' : 'pieces'} →
              </button>
            )}
          </section>
        )}

        {/* ── Craft (skills) ── */}
        {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
          <section className="tpl-ed__section tpl-ed__section--split">
            <h2 className="tpl-ed__label">Craft</h2>
            <div className="tpl-ed__craft">
              {profile.skills.length > 0 && <p><b>Skills</b> {profile.skills.join(', ')}</p>}
              {profile.tools?.length > 0 && <p><b>Tools</b> {profile.tools.join(', ')}</p>}
              {profile.languages?.length > 0 && <p><b>Languages</b> {profile.languages.join(', ')}</p>}
            </div>
          </section>
        )}

        {/* ── Experience ── */}
        {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
          <section className="tpl-ed__section tpl-ed__section--split">
            <h2 className="tpl-ed__label">Experience</h2>
            {profile.limited ? (
              <button className="tpl-ed__more" onClick={onAuth}>
                Sign in to view {profile.experienceTotal} {profile.experienceTotal === 1 ? 'role' : 'roles'} →
              </button>
            ) : (
              <div className="tpl-ed__exp">
                {profile.experienceEntries.map((e, i) => (
                  <div key={i} className="tpl-ed__exp-row">
                    <span className="tpl-ed__exp-when">{experienceRange(e.startDate, e.endDate) || ''}</span>
                    <div>
                      <b>{e.title}</b>{e.organization && <span> — {e.organization}</span>}
                      {e.description && <p>{e.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Colophon / contact ── */}
        <footer className="tpl-ed__colophon">
          <div>
            <h2 className="tpl-ed__name tpl-ed__name--sm">Let's talk.</h2>
            {rate && !profile.limited && <p className="tpl-ed__rate">Starting at {rate}</p>}
          </div>
          {profile.limited ? (
            <button className="tpl-ed__btn tpl-ed__btn--lg" onClick={onAuth}>Sign in to contact {firstName}</button>
          ) : contactHref ? (
            <a className="tpl-ed__btn tpl-ed__btn--lg" href={contactHref}>Contact {firstName}</a>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

export default EditorialTemplate;
