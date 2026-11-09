"use client";

/**
 * StudioTemplate — Swiss/typographic minimalism. Monochrome, hairline rules,
 * lots of air, one accent. Numbered sections read like a well-set index. For
 * people whose taste is the product: architects, product & type designers.
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange } from './shared';
import '../../../styles/templates/studio.css';

const StudioTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => {
  const num = (i: number) => String(i + 1).padStart(2, '0');
  let section = 0;
  const label = (title: string) => `${num(section++)} / ${title}`;

  return (
    <div className="tpl-st">
      <div className="tpl-st__page">
        {/* ── Header row ── */}
        <header className="tpl-st__head">
          <div className="tpl-st__head-l">
            <Avatar src={profile.avatarUrl} name={profile.name} size={40} className="tpl-st__avatar" />
            <span className="tpl-st__mark">{profile.name}</span>
          </div>
          <div className="tpl-st__head-r">
            <span className={`tpl-st__avail tpl-st__avail--${availability.toLowerCase()}`}>
              {AVAILABILITY_LABEL[availability]}
            </span>
            {isOwner ? (
              <button className="tpl-st__ghost" onClick={onEdit}>Edit</button>
            ) : (
              <button className="tpl-st__ghost" onClick={onShare}>Share</button>
            )}
          </div>
        </header>

        {/* ── Intro ── */}
        <section className="tpl-st__intro">
          <h1 className="tpl-st__name">{profile.name}</h1>
          {profile.headline && <p className="tpl-st__headline">{profile.headline}</p>}
          <div className="tpl-st__facts">
            {profile.location && <span>{profile.location}</span>}
            {rate && !profile.limited && <span>{rate}</span>}
            {profile.languages?.length > 0 && <span>{profile.languages.slice(0, 3).join(', ')}</span>}
          </div>
        </section>

        {coverImageUrl && (
          <div className="tpl-st__cover"><img src={coverImageUrl} alt="" loading="lazy" /></div>
        )}

        {/* ── About ── */}
        {profile.bio && (
          <section className="tpl-st__block">
            <h2 className="tpl-st__label">{label('About')}</h2>
            <p className="tpl-st__bio">{profile.bio}</p>
            {profile.limited && <button className="tpl-st__link" onClick={onAuth}>Sign in to read more</button>}
          </section>
        )}

        {/* ── Work ── */}
        {(profile.portfolioItems.length > 0 || hiddenProjects > 0) && (
          <section className="tpl-st__block">
            <h2 className="tpl-st__label">{label('Selected Work')}</h2>
            <div className="tpl-st__work">
              {profile.portfolioItems.map((item, i) => {
                const site = item.previewSite || hostOf(item.projectUrl);
                const inner = (
                  <>
                    <div className="tpl-st__work-text">
                      <h3 className="tpl-st__work-title">{item.title}</h3>
                      {item.outcome && <p className="tpl-st__work-outcome">{item.outcome}</p>}
                      <span className="tpl-st__work-meta">
                        {[item.role, site].filter(Boolean).join(' — ')}{item.projectUrl && ' ↗'}
                      </span>
                    </div>
                    {item.thumbnailUrl && <img className="tpl-st__work-thumb" src={item.thumbnailUrl} alt="" loading="lazy" />}
                  </>
                );
                return item.projectUrl ? (
                  <a key={i} className="tpl-st__work-row" href={item.projectUrl} target="_blank" rel="noopener noreferrer">{inner}</a>
                ) : (
                  <div key={i} className="tpl-st__work-row">{inner}</div>
                );
              })}
            </div>
            {profile.limited && hiddenProjects > 0 && (
              <button className="tpl-st__link" onClick={onAuth}>
                Sign in to see {hiddenProjects} more {hiddenProjects === 1 ? 'project' : 'projects'}
              </button>
            )}
          </section>
        )}

        {/* ── Capabilities ── */}
        {(profile.skills.length > 0 || profile.tools?.length > 0) && (
          <section className="tpl-st__block">
            <h2 className="tpl-st__label">{label('Capabilities')}</h2>
            <div className="tpl-st__caps">
              {profile.skills.length > 0 && (
                <div><span className="tpl-st__caps-k">Skills</span><p>{profile.skills.join(', ')}</p></div>
              )}
              {profile.tools?.length > 0 && (
                <div><span className="tpl-st__caps-k">Tools</span><p>{profile.tools.join(', ')}</p></div>
              )}
            </div>
          </section>
        )}

        {/* ── Experience ── */}
        {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
          <section className="tpl-st__block">
            <h2 className="tpl-st__label">{label('Experience')}</h2>
            {profile.limited ? (
              <button className="tpl-st__link" onClick={onAuth}>
                Sign in to view {profile.experienceTotal} {profile.experienceTotal === 1 ? 'role' : 'roles'}
              </button>
            ) : (
              <div className="tpl-st__exp">
                {profile.experienceEntries.map((e, i) => (
                  <div key={i} className="tpl-st__exp-row">
                    <span className="tpl-st__exp-when">{experienceRange(e.startDate, e.endDate) || ''}</span>
                    <div className="tpl-st__exp-body">
                      <b>{e.title}</b>{e.organization && <span>, {e.organization}</span>}
                      {e.description && <p>{e.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Contact ── */}
        <footer className="tpl-st__foot">
          <h2 className="tpl-st__label">{label('Contact')}</h2>
          {profile.limited ? (
            <button className="tpl-st__cta" onClick={onAuth}>Sign in to contact {firstName} →</button>
          ) : contactHref ? (
            <a className="tpl-st__cta" href={contactHref}>Contact {firstName} →</a>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

export default StudioTemplate;
