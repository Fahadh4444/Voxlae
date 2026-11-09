"use client";

/**
 * RoleScene — animated SVG "stage" illustrations for the role picker.
 *
 * One scene per role, plus a neutral Voxlae scene. Everything is drawn in the
 * brand orange (we deliberately do NOT recolour per role — the *motion and the
 * objects* are what change, not the palette). Each scene loops subtly forever.
 *
 * Rendered inside an <AnimatePresence> so scenes cross-fade as the active role
 * changes.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Role } from '../../api/types';

const O = '#FF6B2C';       // brand orange
const OL = '#FF9A4C';      // light orange
const OD = '#E4551B';      // deep orange
const FAINT = 'rgba(255,255,255,0.28)';

const loop = (duration: number, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  ease: 'easeInOut' as const,
});

const wrap: React.CSSProperties = { width: '100%', height: '100%', maxWidth: 340, maxHeight: 300 };

/* Soft centred platform behind every scene, so each composition reads as
   grounded and centred rather than floating in the corner. */
const SceneBackdrop: React.FC = () => (
  <>
    <defs>
      <radialGradient id="srGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FF6B2C" stopOpacity="0.18" />
        <stop offset="58%" stopColor="#FF6B2C" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#FF6B2C" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="120" cy="100" r="98" fill="url(#srGlow)" />
    <circle cx="120" cy="100" r="84" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
  </>
);

/* ─────────────── Neutral: Voxlae hub ─────────────── */
const NeutralScene: React.FC = () => (
  <svg viewBox="0 0 240 200" style={wrap} fill="none" aria-hidden="true">
    <SceneBackdrop />
    {[0, 1, 2].map(i => (
      <motion.circle
        key={i}
        cx="120" cy="100" stroke={O} strokeWidth="1.5"
        initial={{ r: 18, opacity: 0.5 }}
        animate={{ r: [18, 80], opacity: [0.55, 0] }}
        transition={loop(3.2, i * 1.05)}
      />
    ))}
    {/* orbiting satellites */}
    <motion.g
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
    >
      <circle cx="120" cy="34" r="5" fill={OL} />
      <circle cx="120" cy="166" r="4" fill={O} />
      <circle cx="54" cy="100" r="3.5" fill={FAINT} />
      <circle cx="186" cy="100" r="3.5" fill={OL} />
    </motion.g>
    {/* core */}
    <motion.circle
      cx="120" cy="100" r="16" fill={O}
      animate={{ scale: [1, 1.12, 1] }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      transition={loop(2.4)}
    />
    <path d="M112 96l8 10 8-10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    {/* floating sparks */}
    {[{ x: 66, d: 0 }, { x: 120, d: 1.2 }, { x: 178, d: 0.6 }].map((s, i) => (
      <motion.circle
        key={i} cx={s.x} cy="150" r="2.5" fill={OL}
        animate={{ cy: [160, 120], opacity: [0, 1, 0] }}
        transition={loop(3, s.d)}
      />
    ))}
  </svg>
);

/* ─────────────── Influencer: grow audience ─────────────── */
const InfluencerScene: React.FC = () => {
  const bars = [
    { x: 46, h: 34, d: 0 },
    { x: 82, h: 58, d: 0.15 },
    { x: 118, h: 46, d: 0.3 },
    { x: 154, h: 78, d: 0.45 },
  ];
  return (
    <svg viewBox="0 0 240 200" style={wrap} fill="none" aria-hidden="true">
      <SceneBackdrop />
      {/* axes */}
      <path d="M34 40v112h168" stroke={FAINT} strokeWidth="2" strokeLinecap="round" />
      {/* bars grow from baseline */}
      {bars.map((b, i) => (
        <motion.rect
          key={i}
          x={b.x} y={152 - b.h} width="22" height={b.h} rx="4"
          fill={i % 2 ? OL : O}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          initial={{ scaleY: 0.2 }}
          animate={{ scaleY: [0.2, 1, 0.2] }}
          transition={loop(3.4, b.d)}
        />
      ))}
      {/* growth line drawing over the bars */}
      <motion.path
        d="M40 128 L76 104 L112 112 L150 74 L196 44"
        stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      />
      <motion.circle
        cx="196" cy="44" r="5" fill="#fff"
        animate={{ scale: [0.8, 1.3, 0.8] }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        transition={loop(1.6)}
      />
      {/* floating likes */}
      {[{ x: 120, d: 0 }, { x: 160, d: 0.9 }, { x: 90, d: 1.6 }].map((s, i) => (
        <motion.path
          key={i}
          d="M0 3 C0 1 1.6 0 3 0 C4 0 5 0.8 5 2 C5 0.8 6 0 7 0 C8.4 0 10 1 10 3 C10 5.5 5 8.5 5 8.5 C5 8.5 0 5.5 0 3 Z"
          fill={O}
          animate={{ y: [140, 78], opacity: [0, 1, 0], x: s.x }}
          transition={loop(3.2, s.d)}
        />
      ))}
    </svg>
  );
};

/* ─────────────── Freelancer: services / getting hired ─────────────── */
const FreelancerScene: React.FC = () => (
  <svg viewBox="0 0 240 200" style={wrap} fill="none" aria-hidden="true">
    <SceneBackdrop />
    {/* rotating gear behind */}
    <motion.g
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
    >
      <g stroke={FAINT} strokeWidth="2" fill="none">
        <circle cx="186" cy="52" r="16" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={186 + Math.cos(a) * 16} y1={52 + Math.sin(a) * 16} x2={186 + Math.cos(a) * 22} y2={52 + Math.sin(a) * 22} />;
        })}
      </g>
    </motion.g>

    {/* briefcase */}
    <rect x="40" y="88" width="92" height="66" rx="10" fill={O} />
    <rect x="40" y="88" width="92" height="20" rx="10" fill={OD} />
    <path d="M70 88v-8a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8v8" stroke={OL} strokeWidth="4" strokeLinecap="round" />
    <rect x="78" y="112" width="16" height="12" rx="3" fill="#fff" opacity="0.9" />

    {/* checklist card, items tick in sequence */}
    <rect x="118" y="104" width="86" height="66" rx="10" fill="rgba(255,255,255,0.06)" stroke={FAINT} strokeWidth="1.5" />
    {[0, 1, 2].map(i => {
      const y = 120 + i * 18;
      return (
        <g key={i}>
          <rect x="128" y={y - 8} width="14" height="14" rx="4" fill="none" stroke={OL} strokeWidth="2" />
          <motion.path
            d={`M130 ${y - 1} l3 3 l6 -7`}
            stroke={O} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: [0, 0, 1, 1, 0] }}
            transition={{ duration: 4.2, times: [0, i * 0.18, i * 0.18 + 0.14, 0.9, 1], repeat: Infinity, ease: 'easeOut' }}
          />
          <rect x="150" y={y - 4} width="44" height="5" rx="2.5" fill={FAINT} />
        </g>
      );
    })}
  </svg>
);

/* ─────────────── Brand: broadcast / partner with creators ─────────────── */
const BrandScene: React.FC = () => (
  <svg viewBox="0 0 240 200" style={wrap} fill="none" aria-hidden="true">
    <SceneBackdrop />
    {/* megaphone (pulses gently as if projecting) */}
    <motion.g
      animate={{ scale: [1, 1.04, 1] }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      transition={loop(2.6)}
    >
      <path d="M58 100 L60 118 L70 116 L70 104 Z" fill={OD} />
      <rect x="44" y="90" width="16" height="20" rx="5" fill={OD} />
      <path d="M60 84 L104 70 L104 130 L60 116 Z" fill={O} />
      <path d="M104 82 C118 88 118 112 104 118" stroke={OL} strokeWidth="4" strokeLinecap="round" />
    </motion.g>
    {/* broadcast arcs pulsing outward toward the creators */}
    {[0, 1, 2].map(i => (
      <motion.path
        key={i}
        d="M116 84 C130 92 130 108 116 116"
        stroke={O} strokeWidth="2.5" strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ x: [0, 22], opacity: [0, 0.9, 0] }}
        transition={loop(2.6, i * 0.7)}
      />
    ))}
    {/* creator nodes lighting up in sequence */}
    {[{ x: 178, y: 66 }, { x: 196, y: 100 }, { x: 178, y: 134 }].map((n, i) => (
      <motion.g
        key={i}
        animate={{ scale: [0.82, 1.12, 0.82], opacity: [0.5, 1, 0.5] }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        transition={loop(2.4, 0.8 + i * 0.45)}
      >
        <circle cx={n.x} cy={n.y} r="13" fill={OL} />
        <circle cx={n.x} cy={n.y - 3} r="3.6" fill="#fff" />
        <path d={`M${n.x - 6} ${n.y + 8} a6 6 0 0 1 12 0`} fill="#fff" />
      </motion.g>
    ))}
  </svg>
);

const SCENES: Record<'neutral' | Role, React.FC> = {
  neutral: NeutralScene,
  INFLUENCER: InfluencerScene,
  FREELANCER: FreelancerScene,
  BRAND: BrandScene,
  ADMIN: NeutralScene,
};

const CAPTIONS: Record<'neutral' | Role, { title: string; sub: string }> = {
  neutral:    { title: 'Welcome to Voxlae', sub: 'One account, every side of the creator economy.' },
  INFLUENCER: { title: 'Grow your audience', sub: 'Track your reach and turn content into income.' },
  FREELANCER: { title: 'Get hired for your craft', sub: 'A profile that wins you creator & brand work.' },
  BRAND:      { title: 'Reach the right creators', sub: 'Discover, partner and launch campaigns.' },
  ADMIN:      { title: 'Welcome to Voxlae', sub: 'One account, every side of the creator economy.' },
};

interface Props { role: Role | null; }

const RoleScene: React.FC<Props> = ({ role }) => {
  const key = role ?? 'neutral';
  const Scene = SCENES[key];
  const caption = CAPTIONS[key];
  return (
    <div className="sr-scene">
      <div className="sr-scene__art">
        <Scene />
      </div>
      <div className="sr-scene__caption">
        <h2 className="sr-scene__title">{caption.title}</h2>
        <p className="sr-scene__sub">{caption.sub}</p>
      </div>
    </div>
  );
};

export default RoleScene;
