"use client";

/**
 * Home — Influencer dashboard.
 *
 * A status-aware launcher for the real tools, in two states driven by how many
 * social accounts are connected (GET /api/connections):
 *   1. Fewer than 2 connected → one focused hero: "Connect 2 accounts to unlock
 *      your dashboard", with live progress. The tool grid sits dimmed behind it.
 *   2. 2+ connected → the full launch grid, each tile mirroring a sidebar
 *      destination with a status badge the nav can't show.
 *
 * The sidebar auto-collapses to its icon rail on this page (see DashboardLayout)
 * so the grid owns the width and never competes with a duplicate menu.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from '@/lib/router';
import { useUser } from '../../context/UserContext';
import { getYouTubeStatus, getInstagramStatus, listAutomations } from '../../api/services';
import { ConnectedAccountDTO, AutomationDTO } from '../../api/types';
import {
  IconPlatforms,
  IconTools,
  IconFreelancers,
  IconBrands,
  IconTrends,
  IconLock,
} from './launcherIcons';

import '../../styles/pages/Launcher.css';

/** Accounts required before the dashboard unlocks. */
const REQUIRED_CONNECTIONS = 2;

const Home: React.FC = () => {
  const { user, isAdmin } = useUser();
  const navigate = useNavigate();

  const [connections, setConnections] = useState<ConnectedAccountDTO[]>([]);
  const [automations, setAutomations] = useState<AutomationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // YouTube and Instagram are stored in different places (YouTube is a
      // ConnectedAccount; Instagram is the Instagram-Login connection powering
      // automations), so we ask each platform's own status endpoint — the same
      // sources My Platforms uses. /auth/connections would miss Instagram.
      const [yt, ig, autos] = await Promise.all([
        getYouTubeStatus().catch(() => null),
        getInstagramStatus().catch(() => null),
        listAutomations().catch(() => [] as AutomationDTO[]),
      ]);
      setConnections([yt, ig].filter((c): c is ConnectedAccountDTO => c !== null));
      setAutomations(autos);
    } catch (e: any) {
      console.error('[HOME] Failed to load connections', e);
      setError(e?.message || 'Something went wrong loading your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const connectedCount = connections.length;
  const unlocked = connectedCount >= REQUIRED_CONNECTIONS;
  const activeAutomations = automations.filter((a) => a.enabled).length;
  const totalTriggered = automations.reduce((sum, a) => sum + (a.triggeredCount ?? 0), 0);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="vxl-page">
        <div className="vxl-container">
          <div className="vxl-skel" style={{ height: 96 }} />
          <div className="vxl-skel" style={{ height: 280 }} />
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="vxl-page">
        <div className="vxl-container">
          <div className="vxl-error">
            <h2>Unable to load your dashboard</h2>
            <p>{error}</p>
            <button className="vxl-btn" onClick={load}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="vxl-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="vxl-container">
        <header className="vxl-header">
          <div className="vxl-header__text">
            <h1 className="vxl-greet">
              {unlocked ? `Welcome back, ${firstName} 👋` : `Welcome, ${firstName} 👋`}
            </h1>
            <p className="vxl-sub">
              {unlocked
                ? 'Your workspace — everything Voxlae can do, in one place.'
                : 'One step to unlock your workspace.'}
            </p>
          </div>
          <div className="vxl-avatar">{firstName.charAt(0).toUpperCase()}</div>
        </header>

        {!unlocked ? (
          /* ═══ Connect-2 gate ═══ */
          <>
            <section className="vxl-hero">
              <span className="vxl-hero__pill"><IconLock /> Dashboard locked</span>
              <h2 className="vxl-hero__title">Connect 2 accounts to unlock your dashboard</h2>
              <p className="vxl-hero__desc">
                Voxlae needs at least two connected accounts to build your analytics and unlock
                every tool. Connect the platforms where you actually post.
              </p>

              <div className="vxl-prog">
                <div className="vxl-prog__track">
                  <div
                    className="vxl-prog__fill"
                    style={{ width: `${Math.min(connectedCount / REQUIRED_CONNECTIONS, 1) * 100}%` }}
                  />
                </div>
                <span className="vxl-prog__count">
                  {connectedCount} of {REQUIRED_CONNECTIONS} connected
                </span>
              </div>

              <div className="vxl-connect-row">
                {connections.map((c) => (
                  <span key={c.externalAccountId} className="vxl-chip-done">
                    ✓ {c.platform.toLowerCase()}
                  </span>
                ))}
                <button className="vxl-cbtn" onClick={() => navigate('/influencer/platforms')}>
                  Connect account
                </button>
              </div>

              <div className="vxl-locked-note">
                <IconLock />
                Your tools appear here the moment the second account connects.
              </div>
            </section>

            {/* Preview of what unlocks */}
            <div className="vxl-grid vxl-grid--dimmed" aria-hidden="true">
              <div className="vxl-tile">
                <span className="vxl-tile__icon"><IconPlatforms /></span>
                <h3 className="vxl-tile__title">My Platforms</h3>
                <p className="vxl-tile__desc">Analytics across your channels.</p>
              </div>
              <div className="vxl-tile">
                <span className="vxl-tile__icon"><IconTools /></span>
                <h3 className="vxl-tile__title">Creator Tools</h3>
                <p className="vxl-tile__desc">Instagram DM automations &amp; more.</p>
              </div>
            </div>
          </>
        ) : (
          /* ═══ Unlocked: summary + launcher grid ═══ */
          <>
            <section className="vxl-summary">
              <h2 className="vxl-summary__title">At a glance</h2>
              <div className="vxl-summary__items">
                <div className="vxl-summary__item">
                  <span className="vxl-summary__label">Connected accounts</span>
                  <span className="vxl-summary__value">{connectedCount}</span>
                  <div className="vxl-summary__chips">
                    {connections.map((c) => (
                      <span key={c.externalAccountId} className="vxl-summary__chip">
                        {c.platform.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="vxl-summary__item">
                  <span className="vxl-summary__label">Automations</span>
                  <span className="vxl-summary__value">{activeAutomations}</span>
                  <div className="vxl-summary__meta">
                    {automations.length > 0
                      ? `active · ${automations.length} total`
                      : (
                        <button
                          className="vxl-summary__link"
                          onClick={() => navigate('/influencer/automations')}
                        >
                          Set one up →
                        </button>
                      )}
                  </div>
                </div>

                {totalTriggered > 0 && (
                  <div className="vxl-summary__item">
                    <span className="vxl-summary__label">Replies sent</span>
                    <span className="vxl-summary__value">{totalTriggered}</span>
                    <div className="vxl-summary__meta">by your automations</div>
                  </div>
                )}
              </div>
            </section>

          <div className="vxl-grid">
            <button className="vxl-tile" onClick={() => navigate('/influencer/platforms')}>
              <span className="vxl-badge vxl-badge--ok">{connectedCount} connected</span>
              <span className="vxl-tile__icon"><IconPlatforms /></span>
              <h3 className="vxl-tile__title">My Platforms</h3>
              <p className="vxl-tile__desc">Analytics across your connected channels.</p>
            </button>

            <button className="vxl-tile" onClick={() => navigate('/influencer/creator-tools')}>
              <span className="vxl-badge vxl-badge--new">New</span>
              <span className="vxl-tile__icon"><IconTools /></span>
              <h3 className="vxl-tile__title">Creator Tools</h3>
              <p className="vxl-tile__desc">Instagram DM automations &amp; more.</p>
            </button>

            <button className="vxl-tile" onClick={() => navigate('/influencer/freelancers')}>
              <span className="vxl-badge vxl-badge--neutral">Browse</span>
              <span className="vxl-tile__icon"><IconFreelancers /></span>
              <h3 className="vxl-tile__title">Freelancers</h3>
              <p className="vxl-tile__desc">Find editors, designers and help.</p>
            </button>

            <button className="vxl-tile" onClick={() => navigate('/influencer/brands')}>
              <span className="vxl-badge vxl-badge--neutral">Browse</span>
              <span className="vxl-tile__icon"><IconBrands /></span>
              <h3 className="vxl-tile__title">Brands</h3>
              <p className="vxl-tile__desc">Discover brands looking for creators.</p>
            </button>

            <button className="vxl-tile" onClick={() => navigate('/influencer/trends')}>
              <span className="vxl-badge vxl-badge--neutral">Soon</span>
              <span className="vxl-tile__icon"><IconTrends /></span>
              <h3 className="vxl-tile__title">Trends</h3>
              <p className="vxl-tile__desc">Rising topics in your niche — coming soon.</p>
            </button>

            {isAdmin && (
              <button className="vxl-tile" onClick={() => navigate('/admin')}>
                <span className="vxl-badge vxl-badge--neutral">Admin</span>
                <span className="vxl-tile__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <h3 className="vxl-tile__title">Admin</h3>
                <p className="vxl-tile__desc">Waitlist and admin tools.</p>
              </button>
            )}
          </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default Home;
