"use client";

/**
 * InstagramDashboard — the Instagram view of the platform detail page.
 * Live analytics from the Instagram-Login insights API. Light styling + brand palette
 * (orange · teal · navy) to match the app content area. Range toggle 7/30/90 with deltas.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { InstagramDashboard as Dash, IgKpi, IgPostRow } from '../../api/types';
import { getInstagramDashboard } from '../../api/services';
import VoxlaeLoader from '../common/VoxlaeLoader';
import '../../styles/components/InstagramDashboard.css';

const BRAND = '#FF6B2C', NAVY = '#334A73';
// Grid & axis ink resolve through CSS vars so the charts follow the app theme
// (recharts passes these straight to SVG stroke/fill attributes, which accept
// var() in every browser we support).
const GRID = 'var(--vx-chart-grid)', INK3 = 'var(--vx-chart-axis)';
// Shared tooltip styling so recharts' default white popover doesn't stay white
// on a dark surface.
const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--vx-surface-raised)',
    border: '1px solid var(--vx-border-color)',
    borderRadius: 10,
    boxShadow: 'var(--vx-shadow-lg)',
    color: 'var(--vx-text)',
  },
  labelStyle: { color: 'var(--vx-text-muted)' },
  itemStyle: { color: 'var(--vx-text)' },
} as const;
const RANGES: (7 | 30 | 90)[] = [7, 30, 90];
const POSTS_PER_PAGE = 8;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Recharts tooltip value formatter (value can be undefined). */
const tip = (label: string) => (v: any) => [fmt(Number(v) || 0), label] as [string, string];

const fmt = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
};
const signed = (n: number): string => (n >= 0 ? '+' : '') + fmt(n);

/** Per-KPI delta text + direction. */
function deltaOf(k: IgKpi): { text: string; up: boolean } | null {
  if (k.previous == null) return null;
  const up = k.value >= k.previous;
  if (k.key === 'followers') return { text: signed(Math.round(k.value - k.previous)) , up };
  if (k.key === 'engagement_rate') return { text: signed(Math.round((k.value - k.previous) * 10) / 10) + 'pp', up };
  if (k.previous === 0) return { text: up ? 'new' : '', up };
  const pct = Math.round(((k.value - k.previous) / k.previous) * 100);
  return { text: (pct >= 0 ? '+' : '') + pct + '%', up };
}
const kpiValue = (k: IgKpi) => (k.key === 'engagement_rate' ? k.value.toFixed(1) + '%' : fmt(Math.round(k.value)));

const dayLabel = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
};
/** "Jul 20" style date for the posts table. */
const dateLabel = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

type SortKey = 'date' | 'reach' | 'eng';

const InstagramDashboard: React.FC = () => {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Dash | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-range cache so re-selecting a loaded range is instant. Session-scoped — a hard refresh or
  // the ↻ button forces a live re-fetch. The stale range stays on screen while a new one loads.
  const cacheRef = useRef<Map<number, Dash>>(new Map());

  // Posts table: sorting + pagination (client-side over the range's posts).
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const load = useCallback(async (r: 7 | 30 | 90, force = false) => {
    const cached = cacheRef.current.get(r);
    if (cached && !force) { setData(cached); setError(null); return; }
    setSyncing(true); setError(null);
    try {
      const d = await getInstagramDashboard(r);
      cacheRef.current.set(r, d);
      setData(d);
    } catch (e: any) {
      setError(e?.code === 'not_connected' || e?.message?.includes('connect')
        ? 'Connect an Instagram account to see your analytics.'
        : (e?.message || 'Could not load Instagram analytics.'));
      if (!cacheRef.current.get(r)) setData(null);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const growthData = useMemo(
    () => (data?.growth.points || []).map(p => ({ x: dayLabel(p.date), v: p.value })), [data]);
  // Account-level daily views isn't offered by the API, so we chart Reach only (Views is a KPI total).
  const reachData = useMemo(
    () => (data?.reach.points || []).map(p => ({ x: dayLabel(p.date), reach: p.value })), [data]);
  const ageData = useMemo(() => (data?.age || []).map(b => ({ k: b.key, v: b.value })), [data]);
  const genderData = useMemo(() => (data?.gender || []).map(b => ({ name: b.key, value: b.value })), [data]);

  // Sorted view of the posts for the table.
  const sortedPosts = useMemo(() => {
    const rows = [...(data?.posts || [])];
    const val = (p: IgPostRow) =>
      sortKey === 'date' ? (p.timestamp ? new Date(p.timestamp).getTime() : 0)
      : sortKey === 'reach' ? p.reach
      : (p.engagementRate ?? -1);
    rows.sort((a, b) => (sortDir === 'asc' ? val(a) - val(b) : val(b) - val(a)));
    return rows;
  }, [data, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedPosts.length / POSTS_PER_PAGE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pagePosts = sortedPosts.slice(pageSafe * POSTS_PER_PAGE, pageSafe * POSTS_PER_PAGE + POSTS_PER_PAGE);

  // Reset to the first page whenever the underlying set or sort changes.
  useEffect(() => { setPage(0); }, [data, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };
  const sortArrow = (k: SortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const genderColors = [BRAND, NAVY, INK3];

  return (
    <div className="igd">
      {/* Header */}
      <div className="igd-head">
        <div className="igd-acct">
          <div className="igd-avatar">
            {data?.profile.avatarUrl ? <img src={data.profile.avatarUrl} alt={data.profile.username} />
              : <span>{(data?.profile.username || 'IG').charAt(0).toUpperCase()}</span>}
          </div>
          <div>
            <h2>@{data?.profile.username || 'instagram'}</h2>
            <div className="igd-sub">
              {data && <><b>{fmt(data.profile.followers)}</b> followers · <b>{fmt(data.profile.mediaCount)}</b> posts</>}
            </div>
          </div>
        </div>
        <div className="igd-controls">
          {syncing && data && <span className="igd-sync">Syncing…</span>}
          <div className="igd-seg" role="group" aria-label="Time range">
            {RANGES.map(r => (
              <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}D</button>
            ))}
          </div>
          <button className="igd-refresh" onClick={() => load(range, true)} disabled={syncing}
            title="Refresh live data" aria-label="Refresh">↻</button>
        </div>
      </div>

      {syncing && !data && <VoxlaeLoader variant="section" label="Loading Instagram analytics…" />}
      {error && !data && <div className="igd-note">{error}</div>}

      {data && (
        <div className="igd-body">
          {syncing && (
            <div className="igd-overlay" aria-live="polite">
              <VoxlaeLoader variant="section" label="Updating…" />
            </div>
          )}
          <div className={`igd-body-inner${syncing ? ' is-syncing' : ''}`}>
          {/* KPIs */}
          <div className="igd-kpis">
            {data.kpis.map(k => {
              const d = deltaOf(k);
              return (
                <div className="igd-card igd-kpi" key={k.key}>
                  <div className="igd-kpi-label">{k.label}</div>
                  <div className="igd-kpi-val">{kpiValue(k)}</div>
                  {d && d.text && (
                    <div className={`igd-delta ${d.up ? 'up' : 'down'}`}>{d.up ? '▲' : '▼'} {d.text}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Growth + Reach */}
          <div className="igd-row g2">
            <div className="igd-card">
              <div className="igd-card-h"><h3>Audience growth</h3><span className="igd-hint">Net {signed(data.growth.total)} followers</span></div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={growthData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ig-grow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="x" tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} width={44} tickFormatter={fmt} domain={['dataMin', 'dataMax']} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={tip('Followers')} />
                  <Area type="monotone" dataKey="v" stroke={BRAND} strokeWidth={2.5} fill="url(#ig-grow)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="igd-card">
              <div className="igd-card-h"><h3>Reach</h3><span className="igd-hint">Unique accounts reached per day</span></div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={reachData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="x" tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} width={44} tickFormatter={fmt} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={tip('Reach')} />
                  <Line type="monotone" dataKey="reach" stroke={BRAND} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audience */}
          <div className="igd-row g3">
            <div className="igd-card">
              <div className="igd-card-h"><h3>Age</h3></div>
              {ageData.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ageData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="k" tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip {...TOOLTIP_PROPS} formatter={tip('Followers')} />
                    <Bar dataKey="v" fill={BRAND} radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="igd-empty-sm">Needs 100+ followers</div>}
            </div>
            <div className="igd-card">
              <div className="igd-card-h"><h3>Gender</h3></div>
              {genderData.length ? (
                <div className="igd-gender">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} paddingAngle={2} stroke="none">
                        {genderData.map((_, i) => <Cell key={i} fill={genderColors[i % genderColors.length]} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP_PROPS} formatter={(v: any, n: any) => [fmt(Number(v) || 0), String(n)] as [string, string]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="igd-glegend">
                    {genderData.map((g, i) => (
                      <div key={g.name}><i style={{ background: genderColors[i % genderColors.length] }} />{g.name}</div>
                    ))}
                  </div>
                </div>
              ) : <div className="igd-empty-sm">Needs 100+ followers</div>}
            </div>
            <div className="igd-card">
              <div className="igd-card-h"><h3>Top locations</h3></div>
              <div className="igd-loc">
                {[...data.topCountries].slice(0, 5).map(c => {
                  const max = Math.max(1, ...data.topCountries.map(x => x.value));
                  return (
                    <div className="igd-loc-row" key={c.key}>
                      <span className="igd-loc-name">{c.key}</span>
                      <span className="igd-loc-track"><span className="igd-loc-fill" style={{ width: `${c.value / max * 100}%` }} /></span>
                      <b>{fmt(c.value)}</b>
                    </div>
                  );
                })}
                {!data.topCountries.length && <div className="igd-empty-sm">No location data yet</div>}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="igd-row g-content">
            <div className="igd-card">
              <div className="igd-card-h"><h3>Format performance</h3><span className="igd-hint">Avg engagement rate</span></div>
              <div className="igd-fmt">
                {data.formats.map(f => {
                  const max = Math.max(0.1, ...data.formats.map(x => x.avgEngagementRate));
                  return (
                    <div className="igd-f" key={f.format}>
                      <div className="igd-f-top"><span>{f.format} <em>· {f.count}</em></span><b>{f.avgEngagementRate}%</b></div>
                      <div className="igd-f-track"><span style={{ width: `${f.avgEngagementRate / max * 100}%` }} /></div>
                      <div className="igd-f-meta">avg reach {fmt(f.avgReach)}</div>
                    </div>
                  );
                })}
                {!data.formats.length && <div className="igd-empty-sm">No posts in this period</div>}
              </div>
            </div>
            <div className="igd-card">
              <div className="igd-card-h">
                <h3>Posts</h3>
                <span className="igd-hint">{sortedPosts.length} in last {range}D · engagement vs reach</span>
              </div>
              <div className="igd-tbl-wrap">
                <table className="igd-tbl">
                  <thead>
                    <tr>
                      <th>Post</th>
                      <th>Type</th>
                      <th className="num igd-th-sort" onClick={() => toggleSort('date')} aria-sort={sortKey === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Date{sortArrow('date')}</th>
                      <th className="num igd-th-sort" onClick={() => toggleSort('reach')} aria-sort={sortKey === 'reach' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Reach{sortArrow('reach')}</th>
                      <th className="num igd-th-sort" onClick={() => toggleSort('eng')} aria-sort={sortKey === 'eng' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Eng.{sortArrow('eng')}</th>
                      <th className="num">Saves</th>
                      <th className="num">Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagePosts.map(p => (
                      <tr key={p.mediaId}>
                        <td className="igd-post-cell">
                          {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="igd-thumb" />}
                          <a href={p.permalink} target="_blank" rel="noreferrer">{(p.caption || 'Post').slice(0, 40)}</a>
                        </td>
                        <td><span className="igd-pill">{p.type}</span></td>
                        <td className="num igd-date">{dateLabel(p.timestamp)}</td>
                        <td className="num">{fmt(p.reach)}</td>
                        <td className={`num ${(p.engagementRate ?? 0) >= 6 ? 'igd-er-good' : ''}`}>{p.engagementRate != null ? p.engagementRate + '%' : '—'}</td>
                        <td className="num">{fmt(p.saves)}</td>
                        <td className="num">{fmt(p.shares)}</td>
                      </tr>
                    ))}
                    {!sortedPosts.length && <tr><td colSpan={7} className="igd-empty-sm">No posts in this period</td></tr>}
                  </tbody>
                </table>
              </div>
              {sortedPosts.length > POSTS_PER_PAGE && (
                <div className="igd-pager">
                  <span className="igd-pager-info">
                    {pageSafe * POSTS_PER_PAGE + 1}–{Math.min((pageSafe + 1) * POSTS_PER_PAGE, sortedPosts.length)} of {sortedPosts.length}
                  </span>
                  <div className="igd-pager-btns">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}>Prev</button>
                    <span className="igd-pager-page">{pageSafe + 1}/{pageCount}</span>
                    <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={pageSafe >= pageCount - 1}>Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramDashboard;
