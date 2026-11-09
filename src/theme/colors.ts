/**
 * VOXLAE Design System — Color Tokens (Gradient-First)
 *
 * Brand palette:
 *   Primary: vibrant orange family (base / light / dark)
 *   Secondary: deep navy family (base / dark / soft)
 *   Accents: warm amber gradients, muted grays
 *
 * Every colour exported here maps to a CSS custom property in global.css
 * so they can be consumed from both CSS and JS/TS.
 */

export const colors = {
  /* ── Primary (Fox Orange Family) ───────── */
  primary:        '#FF6B2C',   // Fox orange – CTAs, highlights
  primaryLight:   '#FF8F5C',   // Hover / light tints
  primaryDark:    '#D4501A',   // Active / pressed state – deeper
  primaryDeep:    '#B5400F',   // Extreme depth
  primaryMuted:   'rgba(255,107,44,0.12)', // Subtle backgrounds
  primaryGlow:    'rgba(255,107,44,0.35)', // Focus glow

  /* ── Secondary (Deep Navy Family) ──────── */
  secondary:      '#0F1B3D',   // Deep navy – structure, backgrounds
  secondaryLight: '#1A2D5A',   // Cards on dark bg
  secondarySoft:  '#1E3468',   // Softer card surfaces
  secondaryDark:  '#0A1229',   // Deeper shade
  secondaryDeep:  '#060D1B',   // Extreme depth

  /* ── Accents ───────────────────────────── */
  accent:         '#FFB347',   // Warm amber
  accentLight:    '#FFD699',
  accentDark:     '#E89A2E',

  /* ── Semantic ──────────────────────────── */
  success:        '#2DD4A8',
  successBg:      'rgba(45,212,168,0.12)',
  error:          '#FF4D6A',
  errorBg:        'rgba(255,77,106,0.12)',
  warning:        '#FFB020',
  warningBg:      'rgba(255,176,32,0.12)',
  info:           '#3B82F6',
  infoBg:         'rgba(59,130,246,0.12)',

  /* ── Neutrals ──────────────────────────── */
  white:          '#FFFFFF',
  gray50:         '#F9FAFB',
  gray100:        '#F3F4F6',
  gray200:        '#E5E7EB',
  gray300:        '#D1D5DB',
  gray400:        '#9CA3AF',
  gray500:        '#6B7280',
  gray600:        '#4B5563',
  gray700:        '#374151',
  gray800:        '#1F2937',
  gray900:        '#111827',
  black:          '#000000',

  /* ── Backgrounds ───────────────────────── */
  bgLight:        '#F9FAFB',
  bgLightWarm:    '#FFF8F3',   // Warm tinted light bg
  bgDark:         '#0F1B3D',
  bgDarkCard:     '#162044',
  bgDarkCardHover:'#1C2A55',
  bgOverlay:      'rgba(15,27,61,0.7)',

  /* ── Gradients (as CSS strings) ────────── */
  gradientPrimary:     'linear-gradient(135deg, #FF6B2C 0%, #FF8F5C 100%)',
  gradientPrimaryDeep: 'linear-gradient(135deg, #D4501A 0%, #FF6B2C 100%)',
  gradientHero:        'linear-gradient(160deg, #060D1B 0%, #0F1B3D 30%, #1A2D5A 70%, #0F1B3D 100%)',
  gradientAccent:      'linear-gradient(135deg, #FF6B2C 0%, #FFB347 100%)',
  gradientAccentSoft:  'linear-gradient(135deg, rgba(255,107,44,0.08) 0%, rgba(255,179,71,0.04) 100%)',
  gradientSurface:     'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
  gradientSurfaceWarm: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8F3 100%)',
  gradientDarkCard:    'linear-gradient(145deg, #1A2D5A 0%, #162044 100%)',
  gradientNavy:        'linear-gradient(180deg, #0A1229 0%, #0F1B3D 50%, #1A2D5A 100%)',
  gradientCtaHover:    'linear-gradient(135deg, #D4501A 0%, #FF6B2C 100%)',
  gradientSuccess:     'linear-gradient(135deg, #2DD4A8 0%, #22B890 100%)',
  gradientPageLight:   'linear-gradient(180deg, #F9FAFB 0%, #F3F4F6 100%)',

  /* ── Hero Gradients (Bold SaaS) ────────── */
  gradientHeroBold:    'linear-gradient(160deg, #040A18 0%, #0A1229 25%, #0F1B3D 50%, #1A2D5A 80%, #162044 100%)',
  gradientDiagonal:    'linear-gradient(135deg, #0A1229 0%, #1A2D5A 100%)',
  gradientOrangeBurst: 'linear-gradient(135deg, #FF6B2C 0%, #FFB347 50%, #FF8F5C 100%)',
  gradientGlassCard:   'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
  gradientShapeBlob:   'radial-gradient(circle, rgba(255,107,44,0.18) 0%, rgba(255,107,44,0) 70%)',
  gradientShapeCool:   'radial-gradient(circle, rgba(26,45,90,0.3) 0%, rgba(26,45,90,0) 70%)',
} as const;

export type ColorToken = keyof typeof colors;

export default colors;
