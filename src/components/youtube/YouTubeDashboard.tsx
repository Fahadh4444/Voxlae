"use client";

/**
 * YouTubeDashboard — the YouTube view of the platform detail page.
 * Composed analytics from GET /api/youtube/dashboard. Light styling + brand palette to match the
 * Instagram dashboard. Range toggle 7/30/90 with deltas, demographics, traffic sources and a
 * sortable video performance table.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { YouTubeDashboard as Dash, YtKpi, YtVideoRow } from '../../api/types';
import { getYouTubeDashboard } from '../../api/services';
import VoxlaeLoader from '../common/VoxlaeLoader';
import '../../styles/components/YouTubeDashboard.css';

const BRAND = '#FF0000', NAVY = '#334A73';
// Grid & axis ink resolve through CSS vars so the charts follow the app theme.
const GRID = 'var(--vx-chart-grid)', INK3 = 'var(--vx-chart-axis)';
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
const VIDEOS_PER_PAGE = 8;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRAFFIC_COLORS = ['#FF0000', '#FF6B2C', '#334A73', '#12A37A', '#7C5CFF', 'var(--vx-chart-axis)'];

/** Recharts tooltip value formatter (value can be undefined). */
const tip = (label: string) => (v: any) => [fmt(Number(v) || 0), label] as [string, string];

const fmt = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
};
const signed = (n: number): string => (n >= 0 ? '+' : '') + fmt(n);
/** seconds → "4:13" / "1:02:45" */
const mmss = (secs: number): string => {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
};

/** Per-KPI delta text + direction. */
function deltaOf(k: YtKpi): { text: string; up: boolean } | null {
  if (k.previous == null) return null;
  const up = k.value >= k.previous;
  if (k.key === 'subscribers') return { text: signed(Math.round(k.value - k.previous)), up };
  if (k.key === 'engagement_rate') return { text: signed(Math.round((k.value - k.previous) * 10) / 10) + 'pp', up };
  if (k.key === 'watch_time') return { text: signed(Math.round((k.value - k.previous) * 10) / 10) + 'h', up };
  if (k.previous === 0) return { text: up ? 'new' : '', up };
  const pct = Math.round(((k.value - k.previous) / k.previous) * 100);
  return { text: (pct >= 0 ? '+' : '') + pct + '%', up };
}
const kpiValue = (k: YtKpi) => {
  if (k.key === 'engagement_rate') return k.value.toFixed(1) + '%';
  if (k.key === 'watch_time') return k.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return fmt(Math.round(k.value));
};

const dayLabel = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
};
/** "Jul 20" style date for the videos table. */
const dateLabel = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

type SortKey = 'date' | 'views' | 'eng' | 'watch';

const YouTubeDashboard: React.FC = () => {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Dash | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-range cache so re-selecting a loaded range is instant. Session-scoped — a hard refresh or
  // the ↻ button forces a live re-fetch. The stale range stays on screen while a new one loads.
  const cacheRef = useRef<Map<number, Dash>>(new Map());

  // Videos table: sorting + pagination (client-side over the range's videos).
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const load = useCallback(async (r: 7 | 30 | 90, force = false) => {
    const cached = cacheRef.current.get(r);
    if (cached && !force) { setData(cached); setError(null); return; }
    setSyncing(true); setError(null);
    try {
      const d = await getYouTubeDashboard(r);
      cacheRef.current.set(r, d);
      setData(d);
    } catch (e: any) {
      setError(e?.code === 'not_connected' || e?.message?.includes('connect')
        ? 'Connect a YouTube channel to see your analytics.'
        : (e?.message || 'Could not load YouTube analytics.'));
      if (!cacheRef.current.get(r)) setData(null);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const viewsData = useMemo(
    () => (data?.views.points || []).map(p => ({ x: dayLabel(p.date), v: p.value })), [data]);
  const watchData = useMemo(
    () => (data?.watchTime.points || []).map(p => ({ x: dayLabel(p.date), v: p.value })), [data]);
  const subsData = useMemo(
    () => (data?.subscribers.points || []).map(p => ({ x: dayLabel(p.date), v: p.value })), [data]);
  const ageData = useMemo(() => (data?.age || []).map(b => ({ k: b.key, v: b.value })), [data]);
  const genderData = useMemo(() => (data?.gender || []).map(b => ({ name: b.key, value: b.value })), [data]);
  const trafficData = useMemo(() => (data?.trafficSources || []), [data]);

  // Sorted view of the videos for the table.
  const sortedVideos = useMemo(() => {
    const rows = [...(data?.videos || [])];
    const val = (v: YtVideoRow) =>
      sortKey === 'date' ? (v.publishedAt ? new Date(v.publishedAt).getTime() : 0)
      : sortKey === 'views' ? v.views
      : sortKey === 'watch' ? v.watchMinutes
      : (v.engagementRate ?? -1);
    rows.sort((a, b) => (sortDir === 'asc' ? val(a) - val(b) : val(b) - val(a)));
    return rows;
  }, [data, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedVideos.length / VIDEOS_PER_PAGE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageVideos = sortedVideos.slice(pageSafe * VIDEOS_PER_PAGE, pageSafe * VIDEOS_PER_PAGE + VIDEOS_PER_PAGE);

  // Reset to the first page whenever the underlying set or sort changes.
  useEffect(() => { setPage(0); }, [data, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };
  const sortArrow = (k: SortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const genderColors = [BRAND, NAVY, INK3];

  return (
    <div className="ytd">
      {/* Header */}
      <div className="ytd-head">
        <div className="ytd-acct">
          <div className="ytd-avatar">
            {data?.profile.thumbnailUrl ? <img src={data.profile.thumbnailUrl} alt={data.profile.title} />
              : <span>{(data?.profile.title || 'YT').charAt(0).toUpperCase()}</span>}
          </div>
          <div>
            <h2>{data?.profile.title || 'YouTube'}</h2>
            <div className="ytd-sub">
              {data && <><b>{fmt(data.profile.subscribers)}</b> subscribers · <b>{fmt(data.profile.videoCount)}</b> videos</>}
            </div>
          </div>
        </div>
        <div className="ytd-controls">
          {syncing && data && <span className="ytd-sync">Syncing…</span>}
          <div className="ytd-seg" role="group" aria-label="Time range">
            {RANGES.map(r => (
              <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}D</button>
            ))}
          </div>
          <button className="ytd-refresh" onClick={() => load(range, true)} disabled={syncing}
            title="Refresh live data" aria-label="Refresh">↻</button>
        </div>
      </div>

      {syncing && !data && <VoxlaeLoader variant="section" label="Loading YouTube analytics…" />}
      {error && !data && <div className="ytd-note">{error}</div>}

      {data && (
        <div className="ytd-body">
          {syncing && (
            <div className="ytd-overlay" aria-live="polite">
              <VoxlaeLoader variant="section" label="Updating…" />
            </div>
          )}
          <div className={`ytd-body-inner${syncing ? ' is-syncing' : ''}`}>
          {/* KPIs */}
          <div className="ytd-kpis">
            {data.kpis.map(k => {
              const d = deltaOf(k);
              return (
                <div className="ytd-card ytd-kpi" key={k.key}>
                  <div className="ytd-kpi-label">{k.label}</div>
                  <div className="ytd-kpi-val">{kpiValue(k)}</div>
                  {d && d.text && (
                    <div className={`ytd-delta ${d.up ? 'up' : 'down'}`}>{d.up ? '▲' : '▼'} {d.text}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Views + Watch time */}
          <div className="ytd-row g2">
            <div className="ytd-card">
              <div className="ytd-card-h"><h3>Daily views</h3><span className="ytd-hint">{fmt(data.views.total)} views · vs {fmt(data.views.previousTotal ?? 0)} prev</span></div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={viewsData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="yt-views" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="x" tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} width={44} tickFormatter={fmt} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={tip('Views')} />
                  <Area type="monotone" dataKey="v" stroke={BRAND} strokeWidth={2.5} fill="url(#yt-views)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="ytd-card">
              <div className="ytd-card-h"><h3>Watch time</h3><span className="ytd-hint">Minutes watched per day</span></div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={watchData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="yt-watch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NAVY} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="x" tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} width={44} tickFormatter={fmt} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={tip('Minutes')} />
                  <Area type="monotone" dataKey="v" stroke={NAVY} strokeWidth={2.5} fill="url(#yt-watch)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subscriber growth */}
          <div className="ytd-row">
            <div className="ytd-card">
              <div className="ytd-card-h"><h3>Subscriber growth</h3><span className="ytd-hint">Net {signed(data.subscribers.total)} in last {range}D</span></div>
              {subsData.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={subsData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="yt-subs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#12A37A" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#12A37A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="x" tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} width={48} tickFormatter={fmt} domain={['auto', 'auto']} />
                    <Tooltip {...TOOLTIP_PROPS} formatter={tip('Subscribers')} />
                    <Area type="monotone" dataKey="v" stroke="#12A37A" strokeWidth={2.5} fill="url(#yt-subs)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="ytd-empty-sm">No subscriber snapshots yet — sync your channel first</div>}
            </div>
          </div>

          {/* Audience + Traffic sources */}
          <div className="ytd-row g3">
            <div className="ytd-card">
              <div className="ytd-card-h"><h3>Age</h3></div>
              {ageData.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ageData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="k" tick={{ fontSize: 11, fill: INK3 }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip {...TOOLTIP_PROPS} formatter={tip('% of viewers')} />
                    <Bar dataKey="v" fill={BRAND} radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="ytd-empty-sm">Not enough viewers yet</div>}
            </div>
            <div className="ytd-card">
              <div className="ytd-card-h"><h3>Gender</h3></div>
              {genderData.length ? (
                <div className="ytd-gender">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} paddingAngle={2} stroke="none">
                        {genderData.map((_, i) => <Cell key={i} fill={genderColors[i % genderColors.length]} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP_PROPS} formatter={(v: any, n: any) => [fmt(Number(v) || 0) + '%', String(n)] as [string, string]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="ytd-glegend">
                    {genderData.map((g, i) => (
                      <div key={g.name}><i style={{ background: genderColors[i % genderColors.length] }} />{g.name}</div>
                    ))}
                  </div>
                </div>
              ) : <div className="ytd-empty-sm">Not enough viewers yet</div>}
            </div>
            <div className="ytd-card">
              <div className="ytd-card-h"><h3>Traffic sources</h3><span className="ytd-hint">% of views</span></div>
              <div className="ytd-traffic">
                {trafficData.map((t, i) => (
                  <div className="ytd-tr-row" key={t.source}>
                    <span className="ytd-tr-name">{t.source}</span>
                    <span className="ytd-tr-track">
                      <span className="ytd-tr-fill" style={{
                        width: `${Math.min(100, t.percent)}%`,
                        background: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
                      }} />
                    </span>
                    <b>{t.percent}%</b>
                  </div>
                ))}
                {!trafficData.length && <div className="ytd-empty-sm">No traffic data yet</div>}
              </div>
            </div>
          </div>

          {/* Top geographies */}
          {!!data.topCountries.length && (
            <div className="ytd-row">
              <div className="ytd-card">
                <div className="ytd-card-h"><h3>Top locations</h3><span className="ytd-hint">% of views by country</span></div>
                <div className="ytd-loc">
                  {data.topCountries.map(c => {
                    const max = Math.max(1, ...data.topCountries.map(x => x.value));
                    return (
                      <div className="ytd-loc-row" key={c.key}>
                        <span className="ytd-loc-name">{c.key}</span>
                        <span className="ytd-loc-track"><span className="ytd-loc-fill" style={{ width: `${c.value / max * 100}%` }} /></span>
                        <b>{fmt(c.value)}%</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Format performance + Videos table */}
          <div className="ytd-row g-content">
            <div className="ytd-card">
              <div className="ytd-card-h"><h3>Format performance</h3><span className="ytd-hint">Avg engagement rate</span></div>
              <div className="ytd-fmt">
                {data.formats.map(f => {
                  const max = Math.max(0.1, ...data.formats.map(x => x.avgEngagementRate));
                  return (
                    <div className="ytd-f" key={f.format}>
                      <div className="ytd-f-top"><span>{f.format} <em>· {f.count}</em></span><b>{f.avgEngagementRate}%</b></div>
                      <div className="ytd-f-track"><span style={{ width: `${f.avgEngagementRate / max * 100}%` }} /></div>
                      <div className="ytd-f-meta">avg {fmt(f.avgViews)} views · {fmt(f.avgWatchMinutes)} watch min</div>
                    </div>
                  );
                })}
                {!data.formats.length && <div className="ytd-empty-sm">No video metrics in this period</div>}
              </div>
            </div>
            <div className="ytd-card">
              <div className="ytd-card-h">
                <h3>Videos</h3>
                <span className="ytd-hint">{sortedVideos.length} with views in last {range}D</span>
              </div>
              <div className="ytd-tbl-wrap">
                <table className="ytd-tbl">
                  <thead>
                    <tr>
                      <th>Video</th>
                      <th>Type</th>
                      <th className="num ytd-th-sort" onClick={() => toggleSort('date')} aria-sort={sortKey === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Date{sortArrow('date')}</th>
                      <th className="num ytd-th-sort" onClick={() => toggleSort('views')} aria-sort={sortKey === 'views' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Views{sortArrow('views')}</th>
                      <th className="num ytd-th-sort" onClick={() => toggleSort('watch')} aria-sort={sortKey === 'watch' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Watch{sortArrow('watch')}</th>
                      <th className="num">Avg&nbsp;dur.</th>
                      <th className="num ytd-th-sort" onClick={() => toggleSort('eng')} aria-sort={sortKey === 'eng' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Eng.{sortArrow('eng')}</th>
                      <th className="num">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageVideos.map(v => (
                      <tr key={v.videoId}>
                        <td className="ytd-video-cell">
                          {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="ytd-thumb" />}
                          <a href={v.permalink || `https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer">{(v.title || v.videoId).slice(0, 42)}</a>
                        </td>
                        <td><span className="ytd-pill">{v.type}</span></td>
                        <td className="num ytd-date">{dateLabel(v.publishedAt)}</td>
                        <td className="num">{fmt(v.views)}</td>
                        <td className="num">{fmt(v.watchMinutes)}</td>
                        <td className="num">{mmss(v.avgViewDurationSecs)}</td>
                        <td className={`num ${(v.engagementRate ?? 0) >= 5 ? 'ytd-er-good' : ''}`}>{v.engagementRate != null ? v.engagementRate + '%' : '—'}</td>
                        <td className="num">{fmt(v.comments)}</td>
                      </tr>
                    ))}
                    {!sortedVideos.length && <tr><td colSpan={8} className="ytd-empty-sm">No video metrics in this period — run a video analytics sync</td></tr>}
                  </tbody>
                </table>
              </div>
              {sortedVideos.length > VIDEOS_PER_PAGE && (
                <div className="ytd-pager">
                  <span className="ytd-pager-info">
                    {pageSafe * VIDEOS_PER_PAGE + 1}–{Math.min((pageSafe + 1) * VIDEOS_PER_PAGE, sortedVideos.length)} of {sortedVideos.length}
                  </span>
                  <div className="ytd-pager-btns">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}>Prev</button>
                    <span className="ytd-pager-page">{pageSafe + 1}/{pageCount}</span>
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

export default YouTubeDashboard;
