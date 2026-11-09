"use client";

/**
 * CreatorToolsPage — the Creator Tools hub.
 *
 * Same status-aware launcher pattern as Home, one level down: a grid of the
 * tools grouped under "Creator Tools" in the sidebar, each with a status badge.
 * This is the page the Home "Creator Tools" tile opens.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from '@/lib/router';
import { FEATURES } from '../../config/features';

import { IconAutomations, IconCaption, IconBack } from '../Home/launcherIcons';

import '../../styles/pages/Launcher.css';

const CreatorToolsPage: React.FC = () => {
  const navigate = useNavigate();
  const automationsLive = FEATURES.automations;

  return (
    <motion.div
      className="vxl-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="vxl-container">
        <button className="vxl-crumb" onClick={() => navigate('/influencer/dashboard')}>
          <IconBack /> Home
        </button>

        <header className="vxl-header">
          <div className="vxl-header__text">
            <h1 className="vxl-greet">Creator Tools</h1>
            <p className="vxl-sub">Everything that helps you make and grow — in one place.</p>
          </div>
        </header>

        <div className="vxl-grid">
          <button className="vxl-tile" onClick={() => navigate('/influencer/automations')}>
            <span className={`vxl-badge ${automationsLive ? 'vxl-badge--new' : 'vxl-badge--neutral'}`}>
              {automationsLive ? 'New' : 'Soon'}
            </span>
            <span className="vxl-tile__icon"><IconAutomations /></span>
            <h3 className="vxl-tile__title">Automations</h3>
            <p className="vxl-tile__desc">Instagram DM — comment → auto-reply + DM the link.</p>
          </button>

          <div className="vxl-tile vxl-tile--soon">
            <span className="vxl-badge vxl-badge--neutral">Coming soon</span>
            <span className="vxl-tile__icon"><IconCaption /></span>
            <h3 className="vxl-tile__title">Caption Studio</h3>
            <p className="vxl-tile__desc">AI captions &amp; hashtags — on the way.</p>
          </div>
        </div>
      </div>

    </motion.div>
  );
};

export default CreatorToolsPage;
