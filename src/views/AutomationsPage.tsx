"use client";

/**
 * AutomationsPage — Creator Tools → Automations.
 *
 * Orchestrates three states: (1) connect gate when no Instagram account is linked for
 * automations, (2) the list of automations, (3) the create/edit builder. Handles the
 * ?instagram=connected|error redirect from the OAuth callback.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '@/lib/router';
import { AutomationConnectionDTO, AutomationDTO } from '../api/types';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import {
  getAutomationConnection,
  listAutomations,
  setAutomationEnabled,
  deleteAutomation,
  disconnectAutomationInstagram,
} from '../api/services';
import ConnectGate from '../components/automations/ConnectGate';
import AutomationList from '../components/automations/AutomationList';
import AutomationBuilder from '../components/automations/AutomationBuilder';
import Container from '../components/common/Container';
import { FEATURES } from '../config/features';
import '../styles/components/Automations.css';
import '../styles/pages/LockedPage.css';

type View = { mode: 'list' } | { mode: 'builder'; editing: AutomationDTO | null };

/**
 * "Coming soon" state shown in production until the Meta app is Live (App Review approved).
 * Keeps the feature visible/teased without exposing a flow that can't deliver webhooks yet.
 */
const AutomationsComingSoon: React.FC = () => (
  <Container className="locked-page locked-page--unlocked">
    <div className="locked-page__content">
      <div className="locked-page__icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" className="locked-page__icon">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M12 7v3l2 1" />
        </svg>
      </div>
      <h1 className="locked-page__title">Instagram DM Automations</h1>
      <p className="locked-page__desc">
        Turn comments into replies, DMs and followers — automatically. When someone comments your
        keyword, we reply and slide the link into their DMs, with an optional "follow to unlock" gate.
      </p>
      <div className="locked-page__preview">
        <h3 className="locked-page__preview-title">What's Coming</h3>
        <div className="locked-page__features">
          {[
            { icon: '💬', title: 'Comment → DM', desc: 'Auto-send links when people comment' },
            { icon: '🔒', title: 'Follow to unlock', desc: 'Grow followers before you deliver' },
            { icon: '🎯', title: 'Per-post targeting', desc: 'Any post, or just the ones you pick' },
            { icon: '🔁', title: 'Natural variants', desc: 'Rotated replies that never look botty' },
          ].map((f, i) => (
            <div key={i} className="locked-page__feature">
              <span className="locked-page__feature-icon">{f.icon}</span>
              <div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Container>
);

const AutomationsInner: React.FC = () => {
  const [connection, setConnection] = useState<AutomationConnectionDTO | null | undefined>(undefined);
  const [automations, setAutomations] = useState<AutomationDTO[]>([]);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const refresh = useCallback(async () => {
    try {
      const conn = await getAutomationConnection();
      // Load the automations BEFORE flipping `connection`, so we never render the connected
      // view with an empty list mid-fetch (the "No automations yet" flash). `connection`
      // stays `undefined` — the loader — until both the connection and its list are ready.
      if (conn && conn.active) {
        setAutomations(await listAutomations());
      }
      setConnection(conn);
    } catch (e: any) {
      setError(e?.message || 'Failed to load automations.');
      setConnection(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Handle the OAuth redirect (?instagram=connected|error).
  useEffect(() => {
    const status = searchParams.get('instagram');
    if (!status) return;
    if (status === 'connected') setBanner('Instagram connected! You can create automations now.');
    else if (status === 'error') setError(searchParams.get('reason') || 'Instagram connection failed.');
    searchParams.delete('instagram');
    searchParams.delete('reason');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleToggle = async (a: AutomationDTO) => {
    setBusyId(a.id);
    try {
      const updated = await setAutomationEnabled(a.id, !a.enabled);
      setAutomations((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled: updated.enabled } : x)));
    } catch (e: any) {
      setError(e?.message || 'Could not update the automation.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (a: AutomationDTO) => {
    if (!window.confirm(`Delete "${a.name}"? This can't be undone.`)) return;
    setBusyId(a.id);
    try {
      await deleteAutomation(a.id);
      setAutomations((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e: any) {
      setError(e?.message || 'Could not delete the automation.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Instagram? Your automations will stop running.')) return;
    try {
      await disconnectAutomationInstagram();
      setConnection(null);
      setAutomations([]);
      setView({ mode: 'list' });
    } catch (e: any) {
      setError(e?.message || 'Could not disconnect.');
    }
  };

  const onBuilderSaved = async () => {
    setView({ mode: 'list' });
    setBanner('Automation saved.');
    await refresh();
  };

  if (connection === undefined) {
    return <div className="autos"><VoxlaeLoader variant="page" label="Loading automations…" /></div>;
  }

  return (
    <div className="autos">
      {banner && <div className="autos-note" role="status">{banner}</div>}
      {error && <div className="autos-error" role="alert">{error}</div>}

      {!connection || !connection.active ? (
        <ConnectGate />
      ) : view.mode === 'builder' ? (
        <>
          <div className="autos-head">
            <div>
              <h1>{view.editing ? 'Edit automation' : 'New automation'}</h1>
              <p>Reply to comments and send the link in DMs, automatically.</p>
            </div>
          </div>
          <AutomationBuilder
            editing={view.editing}
            onCancel={() => setView({ mode: 'list' })}
            onSaved={onBuilderSaved}
          />
        </>
      ) : (
        <AutomationList
          automations={automations}
          connection={connection}
          busyId={busyId}
          onNew={() => setView({ mode: 'builder', editing: null })}
          onEdit={(a) => setView({ mode: 'builder', editing: a })}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
};

/**
 * Feature-gated entry point. In production the flag is off (Meta app not Live yet), so users see
 * the "Coming soon" page; the full tool only mounts once VITE_FEATURE_AUTOMATIONS=true.
 */
const AutomationsPage: React.FC = () =>
  FEATURES.automations ? <AutomationsInner /> : <AutomationsComingSoon />;

export default AutomationsPage;
