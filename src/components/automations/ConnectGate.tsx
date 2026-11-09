"use client";

/**
 * ConnectGate — shown when the creator hasn't connected an Instagram account yet.
 * Instagram is connected in ONE place (My Platforms), so this just points them there.
 */
import React from 'react';
import { useNavigate } from '@/lib/router';
import { useUser } from '../../context/UserContext';
import { buildRoleRoute } from '../../utils/roleRoutes';

const ConnectGate: React.FC = () => {
  const navigate = useNavigate();
  const { activeRole } = useUser();

  return (
    <div className="autos-gate">
      <div className="autos-gate-icon" aria-hidden>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
        </svg>
      </div>
      <h2>Connect Instagram to build automations</h2>
      <p>
        Automations run on your connected Instagram account. Connect it from
        <strong> My Platforms</strong>, then come back here to set up comment-to-DM automations.
      </p>
      <ul>
        <li>✅ Reply publicly <em>and</em> DM the link when someone comments your keyword</li>
        <li>🔒 Optional: only unlock the link for people who follow you</li>
        <li>🎯 Choose specific posts/reels, or any post</li>
      </ul>
      <button className="autos-btn autos-btn-primary" onClick={() => navigate(buildRoleRoute(activeRole, 'platforms'))}>
        Go to My Platforms
      </button>
    </div>
  );
};

export default ConnectGate;
