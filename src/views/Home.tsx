"use client";

/**
 * Home — Landing Page (pre-signup)
 *
 * Three-sided story: creators grow, freelancers get hired, brands find talent.
 * - Cinematic dark hero with floating glass decorations
 * - Feature trust strip (no fabricated numbers)
 * - Scroll-morph "what Voxlae does for each audience" centerpiece
 * - Feature deep-dives, platforms marquee, roadmap, closing CTA
 *
 * Nav + Footer come from MainLayout (App.tsx) — not rendered here.
 * All styles are scoped under `.vxl` (see styles/pages/Home.css) so nothing
 * leaks into the rest of the app. CTAs open the shared AuthModal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { FEATURES } from '../config/features';
import type { WaitlistRole } from '../api/types';
import Seo, { organizationJsonLd } from '../components/common/Seo';
import '../styles/pages/Home.css';

/* ── tiny inline icons ── */
const Check: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);
const Arrow: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
);

/* ── role tabs (drives the scroll-morph story) ── */
const ROLES = [
  { plural: 'Creators', label: 'Creator', color: '#FF6B2C',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg> },
  { plural: 'Freelancers', label: 'Freelancer', color: '#E89A2E',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> },
  { plural: 'Brands', label: 'Brand', color: '#2DD4A8',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg> },
];
const STORY_URLS = ['voxlae.co/dashboard', 'voxlae.co/jordan-rivera', 'voxlae.co/discover'];

/* ── platform icons ── */
const ytIcon = <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>;
const igIcon = <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>;
const xIcon = <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const liIcon = <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>;
const snapIcon = <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z" /></svg>;

const PLATFORMS = [
  { name: 'YouTube', color: '#FF3B30', status: 'Available now', soon: false, icon: ytIcon },
  { name: 'Instagram', color: '#E4405F', status: 'Available now', soon: false, icon: igIcon },
  { name: 'X', color: '#111827', status: 'Coming soon', soon: true, icon: xIcon },
  { name: 'LinkedIn', color: '#0A66C2', status: 'Coming soon', soon: true, icon: liIcon },
  { name: 'Snapchat', color: '#E8B800', status: 'Coming soon', soon: true, icon: snapIcon },
];

const STEPS = 3;

const Home: React.FC = () => {
  const navigate = useNavigate();

  const landingRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [flat, setFlat] = useState(false);

  /**
   * Auth lives on its own pages (/signup, /signin). While invite-only /signup is the waitlist, and the
   * story CTAs pass who the visitor is so the form arrives pre-selected.
   */
  const handleGetStarted = (role?: WaitlistRole) => navigate(role ? `/signup?role=${role}` : '/signup');
  const handleSignIn = () => navigate('/signin');
  const ctaLabel = FEATURES.waitlist ? 'Join the waitlist' : 'Get started free';

  /* Scroll-reveal (mirrors the previous landing behaviour) */
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = landingRef.current?.querySelectorAll('.reveal');
    if (!els) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    els.forEach((el) => { if (!el.classList.contains('in')) io.observe(el); });
    return () => io.disconnect();
  }, []);

  /* Top scroll-progress "growth line" (updates the DOM directly — no re-render) */
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (progressRef.current) progressRef.current.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => { document.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  /* Count-up stats — MOBILE ONLY (≤640px). On desktop this bails out immediately,
     so the numbers render exactly as their static JSX (desktop untouched). */
  useEffect(() => {
    if (!window.matchMedia('(max-width: 640px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = landingRef.current?.querySelectorAll<HTMLElement>('.vxl-count');
    if (!els || !els.length) return;

    const fmt = (n: number, d: number) => (d ? n.toFixed(d) : Math.round(n).toString());
    const run = (el: HTMLElement) => {
      if (el.dataset.counted) return;
      el.dataset.counted = '1';
      const to = parseFloat(el.dataset.to || '0');
      const dec = parseInt(el.dataset.dec || '0', 10);
      const suf = el.dataset.suffix || '';
      if (isNaN(to)) return;
      const dur = 1200;
      let t0: number | null = null;
      const tick = (ts: number) => {
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = fmt(to * e, dec) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { run(en.target as HTMLElement); io.unobserve(en.target); } }),
      { threshold: 0.4 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Scroll-morph story: derive the active step from scroll position */
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const computeFlat = () => !window.matchMedia('(min-width: 1001px)').matches || reduce;
    let isFlat = computeFlat();
    setFlat(isFlat);

    const onScroll = () => {
      if (isFlat || !railRef.current) return;
      const rail = railRef.current;
      const total = rail.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const p = Math.max(0, Math.min(0.9999, -rail.getBoundingClientRect().top / total));
      const s = Math.floor(p * STEPS);
      setStep((prev) => (prev === s ? prev : s));
    };
    const onResize = () => { isFlat = computeFlat(); setFlat(isFlat); onScroll(); };

    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    onScroll();
    return () => { document.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, []);

  const goToStep = (i: number) => {
    if (flat || !railRef.current) { setStep(i); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rail = railRef.current;
    const total = rail.offsetHeight - window.innerHeight;
    const target = rail.offsetTop + ((i + 0.5) / STEPS) * total;
    window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
  };

  const activeColor = ROLES[step]?.color ?? '#FF6B2C';

  return (
    <div className="vxl" ref={landingRef}>
      <Seo
        title="Voxlae — Grow as a Creator, Get Hired as a Freelancer, Find Talent as a Brand"
        description="Voxlae is where creators grow their channels, freelancers get hired, and brands find the right people to work with — all in one place."
        canonicalPath="/"
        type="website"
        jsonLd={organizationJsonLd()}
      />

      <div className="scroll-progress" ref={progressRef} aria-hidden="true" />

      {/* ══════════ FIRST SCREEN: HERO + TRUST (fills one viewport) ══════════ */}
      <div className="hero-screen">
      <header className="hero">
        <div className="hero__blob hero__blob--1" />
        <div className="hero__blob hero__blob--2" />

        {/* floating glass decorations */}
        <div className="deco glass deco--social d-yt">{ytIcon}</div>
        <div className="deco glass deco--social d-ig">{igIcon}</div>
        <div className="deco glass deco--social d-tt">{xIcon}</div>
        <div className="deco glass deco--social d-li">{liIcon}</div>

        <div className="deco glass deco-card d-card1">
          <div className="deco-card__bar"><span /><span /><span /></div>
          <div className="deco-card__body">
            <div className="deco-card__line" /><div className="deco-card__line s" />
            <div className="deco-card__chart">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                <defs><linearGradient id="vxlCg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FF6B2C" /><stop offset="1" stopColor="#FFB347" /></linearGradient></defs>
                <path d="M0,35 Q25,30 35,25 T50,20 T65,10 T85,15 T100,5" fill="none" stroke="url(#vxlCg)" strokeWidth="2.5" />
              </svg>
            </div>
          </div>
        </div>

        <div className="deco glass deco-metric d-metric">
          <span className="deco-metric__v vxl-count" data-to="2.4" data-dec="1" data-suffix="M">2.4M</span>
          <span className="deco-metric__l">impressions</span>
          <div className="deco-metric__p"><i /></div>
        </div>

        <div className="deco deco-notif d-notif1"><div className="deco-notif__ic">👤</div><div className="deco-notif__t"><b>New follower</b><span>+1 just now</span></div></div>
        <div className="deco deco-notif d-notif2"><div className="deco-notif__ic">🔥</div><div className="deco-notif__t"><b>Trending</b><span>Your reel is taking off</span></div></div>

        <div className="deco deco-tag d-tag1">#growth</div>
        <div className="deco deco-tag d-tag2">#hiring</div>
        <div className="deco deco-tag d-tag3">#creator</div>

        <div className="deco deco-ring d-ring">
          <svg viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <circle className="deco-ring__p" cx="30" cy="30" r="26" fill="none" stroke="url(#vxlRg)" strokeWidth="4" strokeLinecap="round" />
            <defs><linearGradient id="vxlRg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF6B2C" /><stop offset="1" stopColor="#FFB347" /></linearGradient></defs>
          </svg>
          <span className="deco-ring__v vxl-count" data-to="78" data-suffix="%">78%</span>
        </div>

        <div className="deco glass deco-bars d-bars"><i /><i /><i /><i /><i /></div>
        <div className="deco deco-btn"><span>▶</span> Publish</div>
        <div className="deco glass deco-type"><span>Planning this week</span><i>|</i></div>

        <div className="hero__inner reveal in">
          <div className="hero__eyebrow"><b>Creators</b><span className="dot" /><b>Freelancers</b><span className="dot" /><b>Brands</b></div>
          <h1>
            <span className="hl">Grow your channels,</span>
            <span className="hl accent">get hired<span className="vxl-dtop"> for your work</span>,</span>
            <span className="hl">or find people to work with.</span>
          </h1>
          <p className="hero__sub vxl-sub-full">Voxlae is where creators see how their content is really doing and grow, freelancers build a profile that gets them hired, and brands find the right creators and freelancers to work with.</p>
          <p className="hero__sub vxl-sub-short">Where creators grow, freelancers get hired, and brands find the right people.</p>
          <div className="hero__cta">
            <button className="vxl-btn vxl-btn--primary vxl-btn--lg" onClick={() => handleGetStarted()}>{ctaLabel}</button>
            <button className="vxl-btn vxl-btn--lg vxl-btn--signin" onClick={handleSignIn}>
              {FEATURES.waitlist ? 'Log in' : 'I already have an account'}
            </button>
          </div>
          <p className="hero__note">{FEATURES.waitlist ? 'Invite-only for now · Free to start' : 'Free to start · No credit card required'}</p>
        </div>
      </header>

      {/* ══════════ TRUST STRIP ══════════ */}
      <section className="trust">
        <div className="wrap trust__in">
          <div className="trust__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>All your platforms, one place</div>
          <div className="trust__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m22 11-2 2-2-2" /><path d="M20 13V9" /></svg>For creators, freelancers &amp; brands</div>
          <div className="trust__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>Free to start</div>
          <div className="trust__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>Your data stays yours</div>
        </div>
      </section>
      </div>{/* /hero-screen */}

      {/* ══════════ ★ SCROLL-MORPH STORY ══════════ */}
      <section
        className={`story${flat ? ' story--flat' : ''}`}
        style={{ ['--vxl-active' as string]: activeColor } as React.CSSProperties}
      >
        <div className="story__rail" ref={railRef} style={{ minHeight: flat ? undefined : `${STEPS * 100}vh` }}>
          <div className="story__sticky">
            <div className="story__glow" />
            <div className="story__intro">
              <div className="eyebrow">Creators · Freelancers · Brands</div>
              <h2>See what Voxlae does for a <span className="accent">{ROLES[step]?.label.toLowerCase()}</span></h2>
            </div>

            <div className="story__grid">
              {/* LEFT: tabs + chapters */}
              <div className="story__left">
                <div className="story__tabs" role="tablist" aria-label="Choose a role">
                  {ROLES.map((r, i) => (
                    <button
                      key={r.label}
                      className="story__tab"
                      role="tab"
                      aria-selected={step === i}
                      style={{ ['--tabc' as string]: r.color } as React.CSSProperties}
                      onClick={() => goToStep(i)}
                    >
                      {r.icon} {r.label}
                    </button>
                  ))}
                </div>

                <div className="story__chapters">
                  {/* Creator */}
                  <div className="story__chapter" data-on={String(step === 0)}>
                    <div className="story__k">Creators</div>
                    <h3>Grow your audience</h3>
                    <p>See what's working across every platform, catch trends early, and turn a scroll of numbers into your next post.</p>
                    <ul className="story__list">
                      <li><Check />All your platforms in one clear dashboard</li>
                      <li><Check />Spot trending topics before they peak</li>
                      <li><Check />Turn comments into DMs, automatically</li>
                    </ul>
                    <button className="story__cta" onClick={() => handleGetStarted('CREATOR')}>Grow as a creator <Arrow /></button>
                  </div>
                  {/* Freelancer */}
                  <div className="story__chapter" data-on={String(step === 1)}>
                    <div className="story__k">Freelancers</div>
                    <h3>Get hired for your craft</h3>
                    <p>Editors, designers, managers, strategists — build a profile that gets found by the people who need you.</p>
                    <ul className="story__list">
                      <li><Check />A polished public profile that ranks in search</li>
                      <li><Check />Show your work with ready-made templates</li>
                      <li><Check />Get discovered by creators and brands directly</li>
                    </ul>
                    <button className="story__cta" onClick={() => handleGetStarted('FREELANCER')}>Get hired <Arrow /></button>
                  </div>
                  {/* Brand */}
                  <div className="story__chapter" data-on={String(step === 2)}>
                    <div className="story__k">Brands</div>
                    <h3>Find the right people</h3>
                    <p>Skip the guesswork. Search real creators and freelancers by the signals that actually matter — then reach out from one place.</p>
                    <ul className="story__list">
                      <li><Check />Search creators &amp; freelancers by niche and reach</li>
                      <li><Check />See real engagement, not just follower counts</li>
                      <li><Check />Manage everyone you're talking to in one place</li>
                    </ul>
                    <button className="story__cta" onClick={() => handleGetStarted('BRAND')}>Find talent <Arrow /></button>
                  </div>
                </div>
              </div>

              {/* RIGHT: morphing device */}
              <div className="story__right">
                <div className="stage">
                  <div className="device">
                    <div className="device__bar"><span /><span /><span /><span className="device__url">{STORY_URLS[step]}</span></div>
                    <div className="device__screens">
                      {/* Creator */}
                      <div className="screen" data-on={String(step === 0)}>
                        <div className="sc-head"><b className="vxl-count" data-to="128.4" data-dec="1" data-suffix="K">128.4K</b><span>▲ 18%</span><small>reach · 30d</small></div>
                        <div className="sc-bars">
                          <i style={{ height: '38%' }} /><i style={{ height: '60%' }} /><i style={{ height: '46%' }} /><i style={{ height: '74%' }} /><i style={{ height: '58%' }} /><i style={{ height: '90%' }} /><i style={{ height: '70%' }} /><i style={{ height: '96%' }} />
                        </div>
                        <div className="sc-legend"><span><b>+2.4K</b> followers</span><span><b>6.1%</b> engagement</span><span><b>2</b> platforms</span></div>
                      </div>
                      {/* Freelancer */}
                      <div className="screen" data-on={String(step === 1)}>
                        <div className="sc-profile">
                          <div className="sc-prow"><div className="sc-avatar">🎬</div><div><h4>Jordan Rivera</h4><span className="role">Video Editor &amp; Motion Designer</span></div></div>
                          <div className="sc-skills"><span>Premiere Pro</span><span>After Effects</span><span>Shorts</span><span>Color</span><span>Thumbnails</span></div>
                          <div className="sc-portfolio"><i /><i /><i /></div>
                          <div className="sc-hire">Available for work <span>Hire me →</span></div>
                        </div>
                      </div>
                      {/* Brand */}
                      <div className="screen" data-on={String(step === 2)}>
                        <div className="sc-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg> fitness creators · 50K–200K · US</div>
                        <div className="sc-results">
                          <div className="sc-res"><div className="sc-res__av" style={{ background: 'linear-gradient(135deg,#FF6B2C,#FFB347)' }} /><div className="sc-res__t"><b>@mia.moves</b><span>Fitness · Instagram, YouTube</span></div><div className="sc-res__m"><b>7.8%</b><span>engmt</span></div></div>
                          <div className="sc-res"><div className="sc-res__av" style={{ background: 'linear-gradient(135deg,#5b6ef5,#a35bf5)' }} /><div className="sc-res__t"><b>@liftwithsam</b><span>Fitness · YouTube</span></div><div className="sc-res__m"><b>6.2%</b><span>engmt</span></div></div>
                          <div className="sc-res"><div className="sc-res__av" style={{ background: 'linear-gradient(135deg,#2DD4A8,#22B890)' }} /><div className="sc-res__t"><b>@runwithkay</b><span>Running · Instagram</span></div><div className="sc-res__m"><b>5.9%</b><span>engmt</span></div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="story__dots" aria-hidden="true">
              {ROLES.map((r, i) => <i key={r.label} className={step === i ? 'on' : ''} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FEATURE DEEP-DIVES ══════════ */}
      <section className="sec sec--tint">
        <div className="wrap">
          <div className="sec__head reveal">
            <div className="eyebrow">What you get</div>
            <h2 style={{ marginTop: 14 }}>Everything in one place, <span className="accent">nothing to piece together</span></h2>
            <p>The tools you'd normally juggle across five tabs — measuring, spotting trends, and replying — working together.</p>
          </div>

          <div className="feats">
            {/* Analytics */}
            <article className="feat reveal">
              <div className="feat__body">
                <div className="feat__k">Unified analytics</div>
                <h3>Every platform, one clear picture</h3>
                <p>Stop stitching screenshots together. Connect your accounts once and watch your reach, engagement and growth line up side by side — so you can see what's actually working.</p>
                <ul className="feat__list">
                  <li><Check />Reach, engagement and follower trends over time</li>
                  <li><Check />Compare platforms and posts at a glance</li>
                  <li><Check />Milestones and levels that make progress feel real</li>
                </ul>
              </div>
              <div className="feat__media">
                <div className="mock-analytics">
                  <div className="mock-stat"><b className="vxl-count" data-to="128.4" data-dec="1" data-suffix="K">128.4K</b><span>▲ 18%</span><small>reach · 30d</small></div>
                  <div className="mock-bars">
                    <i style={{ height: '40%', animationDelay: '.05s' }} /><i style={{ height: '62%', animationDelay: '.12s' }} /><i style={{ height: '48%', animationDelay: '.19s' }} /><i style={{ height: '78%', animationDelay: '.26s' }} /><i style={{ height: '66%', animationDelay: '.33s' }} /><i style={{ height: '92%', animationDelay: '.4s' }} /><i style={{ height: '74%', animationDelay: '.47s' }} />
                  </div>
                </div>
              </div>
            </article>

            {/* Trends */}
            <article className="feat feat--rev reveal">
              <div className="feat__body">
                <div className="feat__k">Trends</div>
                <h3>Catch the wave before it breaks</h3>
                <p>See the topics and hashtags gaining reach in your niche right now, ranked so you know where to put your energy — and post while it still counts.</p>
                <ul className="feat__list">
                  <li><Check />Reach-ranked topics and hashtags</li>
                  <li><Check />Tuned to your niche, not a generic feed</li>
                  <li><Check />Turn a trend into your next post in a click</li>
                </ul>
              </div>
              <div className="feat__media">
                <div className="mock-trend">
                  <div className="mock-trend__row"><span className="mock-trend__rank">1</span><span className="mock-trend__tag">#morningroutine</span><span className="mock-trend__bar" style={{ width: 64 }} /><span className="mock-trend__pct">+240%</span></div>
                  <div className="mock-trend__row"><span className="mock-trend__rank">2</span><span className="mock-trend__tag">#dayinmylife</span><span className="mock-trend__bar" style={{ width: 48 }} /><span className="mock-trend__pct">+186%</span></div>
                  <div className="mock-trend__row"><span className="mock-trend__rank">3</span><span className="mock-trend__tag">#getreadywithme</span><span className="mock-trend__bar" style={{ width: 38 }} /><span className="mock-trend__pct">+142%</span></div>
                  <div className="mock-trend__row"><span className="mock-trend__rank">4</span><span className="mock-trend__tag">#smallbusiness</span><span className="mock-trend__bar" style={{ width: 28 }} /><span className="mock-trend__pct">+97%</span></div>
                </div>
              </div>
            </article>

            {/* Automations */}
            <article className="feat reveal">
              <div className="feat__body">
                <div className="feat__k">Automations</div>
                <h3>Put the repetitive stuff on autopilot</h3>
                <p>Set up automations that handle the busywork of growing an account, so you can focus on making things. The first one turns keyword comments into replies and DMs — with more automations on the way.</p>
                <ul className="feat__list">
                  <li><Check />Comment keyword → auto reply + DM (available now)</li>
                  <li><Check />Runs on the posts you choose, in your own words</li>
                  <li><Check />More automations coming — you pick what runs</li>
                </ul>
              </div>
              <div className="feat__media">
                <div className="mock-auto">
                  <div className="auto-flow">comment <b>“LINK”</b> → reply → <b>DM sent</b></div>
                  <div className="chat"><div className="chat__av" /><div className="bubble bubble--in">Drop me the LINK please 🙏</div></div>
                  <div className="chat chat--out"><div className="chat__av" /><div className="bubble bubble--out">Just checked your DMs 📩</div></div>
                  <div className="chat chat--out"><div className="chat__av" /><div className="bubble bubble--out">Here's the link you asked for → voxlae.co/guide</div></div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ══════════ PLATFORMS (marquee) ══════════ */}
      <section className="sec">
        <div className="wrap plat-head reveal">
          <div className="eyebrow">Integrations</div>
          <h2>Start with the ones you use. <span className="accent">More on the way.</span></h2>
          <p>Connect YouTube and Instagram today — we're adding more platforms as we grow.</p>
        </div>
        <div className="marquee reveal">
          <div className="marquee__track">
            {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
              <div key={`${p.name}-${i}`} className={`plat__item${p.soon ? ' plat__item--soon' : ''}`} style={{ ['--pc' as string]: p.color } as React.CSSProperties}>
                <div className="plat__ic">{p.icon}</div>
                <div><div className="plat__n">{p.name}</div><div className="plat__s">{p.status}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ ROADMAP ══════════ */}
      <section className="sec sec--tint">
        <div className="wrap">
          <div className="sec__head reveal">
            <div className="eyebrow">Where we're headed</div>
            <h2 style={{ marginTop: 14 }}>This is just the <span className="accent">starting line</span></h2>
            <p>Voxlae is growing fast. Here's what we're building next to close the loop between creating, getting hired, and hiring.</p>
          </div>
          <div className="road">
            <div className="road__card reveal"><span className="road__tag">Coming soon</span><h4>Paid collaborations</h4><p>Brands and creators agree on a deal, deliver the work, and get paid — all inside Voxlae, with nothing lost in DMs.</p></div>
            <div className="road__card reveal" style={{ ['--d' as string]: '.1s' } as React.CSSProperties}><span className="road__tag">Coming soon</span><h4>Hiring &amp; payments</h4><p>Book a freelancer, set the scope, and handle payment safely without leaving the platform.</p></div>
            <div className="road__card reveal" style={{ ['--d' as string]: '.2s' } as React.CSSProperties}><span className="road__tag">On the roadmap</span><h4>More platforms &amp; deeper insights</h4><p>More networks to connect and richer signals, so every decision you make is backed by what's really happening.</p></div>
          </div>
        </div>
      </section>

      {/* ══════════ CLOSING CTA ══════════ */}
      <section className="close">
        <div className="close__blob close__blob--1" />
        <div className="close__blob close__blob--2" />
        <div className="close__in reveal">
          <h2>{FEATURES.waitlist ? 'Be first in line' : 'Get started in a few minutes'}</h2>
          <p>Create a free account, connect YouTube or Instagram, and see where you stand — or set up your profile to get hired, or find people to work with. No credit card, no setup fees.</p>
          <div className="close__cta">
            <button className="vxl-btn vxl-btn--primary vxl-btn--lg" onClick={() => handleGetStarted()}>{ctaLabel}</button>
            <button className="vxl-btn vxl-btn--lg vxl-btn--signin" onClick={handleSignIn}>Log in</button>
          </div>
          <p className="close__note">Free forever to start · No credit card required</p>
        </div>
      </section>

    </div>
  );
};

export default Home;
