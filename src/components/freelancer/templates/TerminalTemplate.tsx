"use client";

/**
 * TerminalTemplate — the whole profile as a hacker terminal. Monospace, a window
 * chrome with traffic-lights, prompt lines and code-block projects. For people who
 * live in a shell: developers, technical and generative artists.
 */

import React from 'react';
import Avatar from '../../common/Avatar';
import { ProfileTemplateProps } from './types';
import { AVAILABILITY_LABEL, hostOf, experienceRange } from './shared';
import '../../../styles/templates/terminal.css';

const Cmd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="tpl-term__cmd-line">
    <span className="tpl-term__prompt">visitor@voxlae</span>
    <span className="tpl-term__sep">:</span>
    <span className="tpl-term__path">~</span>
    <span className="tpl-term__sep">$</span>
    <span className="tpl-term__cmd"> {children}</span>
  </div>
);

const TerminalTemplate: React.FC<ProfileTemplateProps> = ({
  profile, isOwner, firstName, rate, availability, hiddenProjects,
  coverImageUrl, contactHref, onShare, onAuth, onEdit,
}) => {
  const slugName = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'freelancer';

  return (
    <div className="tpl-term">
      <div className="tpl-term__win">
        <div className="tpl-term__bar">
          <span className="tpl-term__dots"><i /><i /><i /></span>
          <span className="tpl-term__bar-title">{slugName} — portfolio.sh</span>
          <span className="tpl-term__bar-actions">
            {isOwner ? (
              <button onClick={onEdit}>edit</button>
            ) : (
              <button onClick={onShare}>share</button>
            )}
          </span>
        </div>

        <div className="tpl-term__body">
          {/* whoami */}
          <Cmd>whoami</Cmd>
          <div className="tpl-term__who">
            <Avatar src={profile.avatarUrl} name={profile.name} size={54} className="tpl-term__avatar" />
            <div>
              <span className="tpl-term__name">{profile.name}</span>
              {profile.headline && <span className="tpl-term__comment"># {profile.headline}</span>}
            </div>
          </div>

          <div className="tpl-term__status">
            <span className={`tpl-term__led tpl-term__led--${availability.toLowerCase()}`} />
            status: {AVAILABILITY_LABEL[availability].toLowerCase()}
            {profile.location && <> · loc: {profile.location}</>}
            {rate && !profile.limited && <> · rate: {rate}</>}
          </div>

          <div className="tpl-term__run">
            {isOwner ? (
              <button className="tpl-term__key" onClick={onEdit}>./edit.sh</button>
            ) : profile.limited ? (
              <button className="tpl-term__key" onClick={onAuth}>./login.sh</button>
            ) : contactHref ? (
              <a className="tpl-term__key" href={contactHref}>./contact.sh</a>
            ) : null}
            <span className="tpl-term__cursor" aria-hidden="true" />
          </div>

          {coverImageUrl && (
            <>
              <Cmd>open cover.png</Cmd>
              <div className="tpl-term__figure"><img src={coverImageUrl} alt="" loading="lazy" /></div>
            </>
          )}

          {/* about */}
          {profile.bio && (
            <>
              <Cmd>cat about.md</Cmd>
              <p className="tpl-term__out">{profile.bio}</p>
              {profile.limited && <button className="tpl-term__link" onClick={onAuth}>{'>'} unlock full README</button>}
            </>
          )}

          {/* projects */}
          {(profile.portfolioItems.length > 0 || hiddenProjects > 0) && (
            <>
              <Cmd>ls -la ./projects</Cmd>
              <div className="tpl-term__projects">
                {profile.portfolioItems.map((item, i) => {
                  const site = item.previewSite || hostOf(item.projectUrl);
                  return (
                    <div key={i} className="tpl-term__proj">
                      <div className="tpl-term__proj-head">
                        <span className="tpl-term__proj-name">▸ {String(i + 1).padStart(2, '0')}_{item.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}</span>
                        {item.projectUrl && (
                          <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="tpl-term__link">open ↗</a>
                        )}
                      </div>
                      {item.thumbnailUrl && <img className="tpl-term__proj-thumb" src={item.thumbnailUrl} alt="" loading="lazy" />}
                      <p className="tpl-term__proj-title">{item.title}</p>
                      {item.outcome && <p className="tpl-term__proj-out">{item.outcome}</p>}
                      <p className="tpl-term__proj-meta">{['// ' + (item.role || 'contributor'), site].filter(Boolean).join('  ·  ')}</p>
                    </div>
                  );
                })}
                {profile.limited && hiddenProjects > 0 && (
                  <button className="tpl-term__proj tpl-term__proj--locked" onClick={onAuth}>
                    {'>'} {hiddenProjects} more {hiddenProjects === 1 ? 'file' : 'files'} — ./login.sh to read
                  </button>
                )}
              </div>
            </>
          )}

          {/* skills */}
          {(profile.skills.length > 0 || profile.tools?.length > 0 || profile.languages?.length > 0) && (
            <>
              <Cmd>echo $STACK</Cmd>
              <div className="tpl-term__stack">
                {profile.skills.length > 0 && <p><span className="tpl-term__k">skills</span>=({profile.skills.map(s => `"${s}"`).join(' ')})</p>}
                {profile.tools?.length > 0 && <p><span className="tpl-term__k">tools</span>=({profile.tools.map(s => `"${s}"`).join(' ')})</p>}
                {profile.languages?.length > 0 && <p><span className="tpl-term__k">langs</span>=({profile.languages.map(s => `"${s}"`).join(' ')})</p>}
              </div>
            </>
          )}

          {/* experience */}
          {(profile.experienceEntries.length > 0 || (profile.limited && profile.experienceTotal > 0)) && (
            <>
              <Cmd>git log --oneline</Cmd>
              {profile.limited ? (
                <button className="tpl-term__link" onClick={onAuth}>{'>'} ./login.sh to view {profile.experienceTotal} commits</button>
              ) : (
                <div className="tpl-term__log">
                  {profile.experienceEntries.map((e, i) => (
                    <p key={i}>
                      <span className="tpl-term__hash">{Math.abs((e.title || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)).toString(16).slice(0, 7).padStart(7, '0')}</span>
                      {' '}{e.title}{e.organization && <span className="tpl-term__dim"> @ {e.organization}</span>}
                      <span className="tpl-term__dim"> ({experienceRange(e.startDate, e.endDate)})</span>
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* contact */}
          <Cmd>./contact.sh</Cmd>
          <div className="tpl-term__contact">
            {profile.limited ? (
              <button className="tpl-term__key" onClick={onAuth}>sign in to reach {firstName} →</button>
            ) : contactHref ? (
              <a className="tpl-term__key" href={contactHref}>mail {firstName} →</a>
            ) : (
              <span className="tpl-term__dim">no public contact</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalTemplate;
