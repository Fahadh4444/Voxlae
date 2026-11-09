"use client";

/**
 * AutomationList — the creator's saved automations, with enable/disable, edit and delete.
 */
import React from 'react';
import { AutomationConnectionDTO, AutomationDTO } from '../../api/types';

interface Props {
  automations: AutomationDTO[];
  connection: AutomationConnectionDTO;
  busyId: string | null;
  onNew: () => void;
  onEdit: (a: AutomationDTO) => void;
  onToggle: (a: AutomationDTO) => void;
  onDelete: (a: AutomationDTO) => void;
  onDisconnect: () => void;
}

const targetSummary = (a: AutomationDTO): string => {
  if (a.targetMode === 'ANY') return 'Any post';
  const n = a.targets.length;
  return `${n} post${n === 1 ? '' : 's'}`;
};

const keywordSummary = (a: AutomationDTO): string => {
  if (a.keywordMatchMode === 'ANY_COMMENT') return 'Any comment';
  return a.keywords.slice(0, 3).map((k) => `"${k}"`).join(', ') + (a.keywords.length > 3 ? '…' : '');
};

const AutomationList: React.FC<Props> = ({
  automations, connection, busyId, onNew, onEdit, onToggle, onDelete, onDisconnect,
}) => {
  const initial = (connection.username || '?').charAt(0).toUpperCase();

  return (
    <>
      <div className="autos-head">
        <div>
          <h1>Automations</h1>
          <p className="autos-sub">Turn comments into replies, DMs and followers — automatically.</p>
        </div>
        <button className="autos-btn autos-btn-primary" onClick={onNew}>+ New automation</button>
      </div>

      {/* Connected account */}
      <div className="autos-conn">
        <div className="autos-conn-ava">
          {connection.accountAvatarUrl
            ? <img src={connection.accountAvatarUrl} alt={connection.username} />
            : <span>{initial}</span>}
        </div>
        <div className="autos-conn-info">
          <span className="autos-conn-name">@{connection.username}</span>
          <span className="autos-conn-status">
            <span className="autos-dot" /> Connected
            {!connection.webhookSubscribed && <span className="autos-conn-warn"> · webhook not active yet</span>}
          </span>
        </div>
        <button className="autos-btn autos-btn-ghost autos-conn-disc" onClick={onDisconnect}>Disconnect</button>
      </div>

      {automations.length === 0 ? (
        <div className="autos-empty">
          <div className="autos-empty-icon" aria-hidden>💬</div>
          <p>No automations yet.</p>
          <button className="autos-btn autos-btn-primary" onClick={onNew}>Create your first automation</button>
        </div>
      ) : (
        <div className="autos-list">
          {automations.map((a) => (
            <div className={`autos-card${a.enabled ? '' : ' autos-card--off'}`} key={a.id}>
              <div className="autos-card-main">
                <div className="autos-card-title">
                  <strong>{a.name}</strong>
                  <span className={`autos-badge ${a.type === 'KEYWORD_REPLY_FOLLOW_GATED' ? 'autos-badge-gated' : 'autos-badge-reply'}`}>
                    {a.type === 'KEYWORD_REPLY_FOLLOW_GATED' ? 'Follow-gated' : 'Reply + DM'}
                  </span>
                  {!a.enabled && <span className="autos-badge autos-badge-off">Paused</span>}
                </div>
                <div className="autos-chips">
                  <span className="autos-chip" title="Trigger">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    {keywordSummary(a)}
                  </span>
                  <span className="autos-chip" title="Applies to">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                    {targetSummary(a)}
                  </span>
                </div>
                <div className="autos-stats">
                  <span className="autos-stat"><b>{a.triggeredCount ?? 0}</b> triggered</span>
                  <span className="autos-stat"><b>{a.dmSentCount ?? 0}</b> DMs sent</span>
                </div>
              </div>
              <div className="autos-card-actions">
                <label className="autos-switch" title={a.enabled ? 'On' : 'Off'}>
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    disabled={busyId === a.id}
                    onChange={() => onToggle(a)}
                  />
                  <span className="autos-switch-track" />
                </label>
                <button className="autos-btn autos-btn-ghost" onClick={() => onEdit(a)}>Edit</button>
                <button className="autos-btn autos-btn-danger" onClick={() => onDelete(a)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default AutomationList;
