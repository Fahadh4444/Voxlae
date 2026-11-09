"use client";

/**
 * TimeSeriesChart — Reusable multi-line time series graph
 *
 * Pure SVG. No external charting library.
 * Supports multiple trend lines, metric selector, hover tooltips.
 * Uses VOXLAE design tokens.
 */

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import './TimeSeriesChart.css';

/* ── Types ── */

export interface TimeSeriesDataPoint {
  date: string;       // YYYY-MM-DD
  platform: string;
  views: number;
  followers: number;
}

export type MetricKey = 'views' | 'followers';

export interface PlatformLineConfig {
  id: string;
  label: string;
  color: string;
}

export interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  platforms: PlatformLineConfig[];
  /** The date range actually requested (YYYY-MM-DD), so the chart honestly reflects the
   *  selected preset even when real data doesn't cover the whole span. Without this the
   *  x-axis silently shrinks to whatever rows came back, making "30d" vs "12 months" look
   *  visually identical once you're past the available history — which reads as broken. */
  startDate: string;
  endDate: string;
  defaultMetric?: MetricKey;
  height?: number;
  className?: string;
  /** Override display labels for metrics (e.g. { views: 'Reach' } for Instagram-only) */
  metricLabels?: Partial<Record<MetricKey, string>>;
  /** Metrics that have no data for the current platform set — greyed out in selector */
  unavailableMetrics?: MetricKey[];
}

/* ── Constants ── */

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'views', label: 'Views' },
  { key: 'followers', label: 'Followers' },
];

const PADDING = { top: 20, right: 20, bottom: 36, left: 52 };

/* ── Component ── */

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  platforms,
  startDate,
  endDate,
  defaultMetric = 'views',
  height = 320,
  className = '',
  metricLabels,
  unavailableMetrics = [],
}) => {
  const [metric, setMetric] = useState<MetricKey>(defaultMetric);

  // Auto-switch away if the active metric becomes unavailable
  useEffect(() => {
    if (unavailableMetrics.includes(metric)) {
      const fallback = METRICS.find(m => !unavailableMetrics.includes(m.key));
      if (fallback) setMetric(fallback.key);
    }
  }, [unavailableMetrics, metric]);
  // Store the date index; all positions are derived in viewBox units at render time so the
  // hover line, dots, and tooltip stay aligned regardless of the SVG's stretched width.
  const [tooltip, setTooltip] = useState<{
    idx: number; date: string; platform: string; value: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /* ── Derived data ── */

  // Every calendar day in the REQUESTED range (not just days that happen to have data). This is
  // what makes the x-axis honestly reflect the selected preset — e.g. "Last 12 months" spans a
  // full year even though real history only covers the last ~90 days; the older portion simply
  // renders as a gap instead of the chart silently shrinking to look identical to "Last 90 days".
  const dates = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      // Defensive fallback: derive from whatever data we actually got.
      return Array.from(new Set(data.map(d => d.date))).sort();
    }
    const result: string[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      result.push(new Date(t).toISOString().split('T')[0]);
    }
    return result;
  }, [startDate, endDate, data]);

  // Group data by platform → ordered array of values matching dates. A `null` value means
  // "no data for this date" and is rendered as a gap (not a fabricated point).
  // - "followers" is a real cumulative snapshot: we only have it for days actually recorded.
  //   Before the first real snapshot there is NO data (gap — the platform can't give us history);
  //   from the first real point on we carry the last value forward across interior gaps.
  // - "views" is a per-day flow: a missing day is genuinely 0.
  const series = useMemo(() => {
    return platforms.map(p => {
      const lookup = new Map<string, number>();
      data
        .filter(d => d.platform === p.id)
        .forEach(d => lookup.set(d.date, d[metric]));

      if (metric === 'followers') {
        // Platforms don't expose historical follower TOTALS, so real data usually only starts a
        // few days back (or just today). Everything BEFORE the first real capture is a genuine
        // gap — carrying today's count backward across a whole year would fabricate history we
        // don't have. From the first real point onward we carry the value forward across any
        // interior gaps (e.g. a day the sync job missed).
        const firstRealIdx = dates.findIndex(d => (lookup.get(d) ?? 0) > 0);
        let last: number | null = null;
        return {
          ...p,
          values: dates.map((date, i): number | null => {
            if (firstRealIdx === -1 || i < firstRealIdx) return null; // no data yet → gap
            const v = lookup.get(date);
            if (v !== undefined && v > 0) last = v;
            return last;
          }),
        };
      }

      // "views" (flow): plot the real value where a row exists (0 is a real 0-view day);
      // a date with no row is missing data → gap, not a fake 0 drop.
      return {
        ...p,
        values: dates.map((date): number | null => (lookup.has(date) ? lookup.get(date)! : null)),
      };
    });
  }, [data, platforms, metric, dates]);

  // Y extent (ignore gaps)
  const yMax = useMemo(() => {
    let max = 0;
    series.forEach(s => s.values.forEach(v => { if (v !== null && v > max) max = v; }));
    return max || 1;
  }, [series]);

  // Note any platform whose real history starts AFTER the selected range's start — so widening
  // the range (e.g. to "12 months") honestly communicates "data available from <date> onward"
  // instead of the chart just looking unchanged or fabricating older values.
  const coverageNotes = useMemo(() => {
    if (dates.length === 0) return [] as { label: string; from: string }[];
    return series
      .map(s => {
        const firstIdx = s.values.findIndex(v => v !== null);
        return firstIdx > 0 ? { label: s.label, from: dates[firstIdx] } : null;
      })
      .filter((n): n is { label: string; from: string } => n !== null);
  }, [series, dates]);

  // True when the selected range has NO data at all for any platform (distinct from "some
  // platforms have partial coverage") — shown as a friendly empty state instead of a blank chart.
  const hasAnyData = useMemo(() => series.some(s => s.values.some(v => v !== null)), [series]);

  // Nice Y-axis ticks (4 ticks)
  const yTicks = useMemo(() => {
    const step = Math.ceil(yMax / 4);
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(step * i);
    return ticks;
  }, [yMax]);

  const yTickMax = yTicks[yTicks.length - 1] || 1;

  /* ── Scale helpers ── */

  const xScale = useCallback(
    (i: number, width: number) => {
      const inner = width - PADDING.left - PADDING.right;
      return PADDING.left + (dates.length <= 1 ? inner / 2 : (i / (dates.length - 1)) * inner);
    },
    [dates.length],
  );

  const yScale = useCallback(
    (v: number) => {
      const inner = height - PADDING.top - PADDING.bottom;
      return PADDING.top + inner - (v / yTickMax) * inner;
    },
    [height, yTickMax],
  );

  /* ── Build paths ── */

  const buildPath = useCallback(
    (values: (number | null)[], width: number) => {
      let d = '';
      let penDown = false;
      values.forEach((v, i) => {
        if (v === null) { penDown = false; return; } // gap → lift the pen
        d += `${penDown ? 'L' : 'M'}${xScale(i, width).toFixed(1)},${yScale(v).toFixed(1)} `;
        penDown = true;
      });
      return d.trim();
    },
    [xScale, yScale],
  );

  /* ── Hover handling ── */

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || dates.length === 0) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // The SVG is stretched (viewBox 800 wide, preserveAspectRatio="none"): convert the pointer
      // from rendered pixels into viewBox units before hit-testing.
      const vbX = rect.width > 0 ? (mouseX / rect.width) * 800 : 0;
      const vbY = rect.height > 0 ? (mouseY / rect.height) * height : mouseY;

      // Find nearest date index
      const inner = 800 - PADDING.left - PADDING.right;
      const ratio = (vbX - PADDING.left) / inner;
      const idx = Math.max(0, Math.min(dates.length - 1, Math.round(ratio * (dates.length - 1))));

      // Find nearest platform that actually has data at this date (compare in viewBox units)
      let bestPlatform: typeof series[number] | null = null;
      let bestValue = 0;
      let bestDist = Infinity;
      series.forEach(s => {
        const val = s.values[idx];
        if (val === null) return; // no data here → not hoverable
        const dist = Math.abs(vbY - yScale(val));
        if (dist < bestDist) {
          bestDist = dist;
          bestPlatform = s;
          bestValue = val;
        }
      });

      if (bestPlatform && bestDist < 60) {
        setTooltip({
          idx,
          date: dates[idx],
          platform: (bestPlatform as typeof series[number]).label,
          value: bestValue,
        });
      } else {
        setTooltip(null);
      }
    },
    [dates, series, yScale, height],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  /* ── X-axis label thinning ── */
  const labelEvery = dates.length > 15 ? Math.ceil(dates.length / 8) : dates.length > 7 ? 2 : 1;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatValue = (v: number) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toString();
  };

  /* ── Render ── */

  return (
    <div className={`vx-ts-chart ${className}`}>
      {/* Metric selector */}
      <div className="vx-ts-chart__controls">
        <div className="vx-ts-chart__metric-selector">
          {METRICS.map(m => {
            const isUnavailable = unavailableMetrics.includes(m.key);
            const label = metricLabels?.[m.key] ?? m.label;
            return (
              <button
                key={m.key}
                className={[
                  'vx-ts-chart__metric-btn',
                  metric === m.key ? 'vx-ts-chart__metric-btn--active' : '',
                  isUnavailable ? 'vx-ts-chart__metric-btn--unavailable' : '',
                ].join(' ').trim()}
                onClick={() => !isUnavailable && setMetric(m.key)}
                title={isUnavailable ? `${label} data is not available from the Instagram API` : undefined}
                aria-disabled={isUnavailable}
              >
                {label}
                {isUnavailable && <span className="vx-ts-chart__metric-na"> N/A</span>}
              </button>
            );
          })}
        </div>
        {/* Legend */}
        <div className="vx-ts-chart__legend">
          {platforms.map(p => (
            <span key={p.id} className="vx-ts-chart__legend-item">
              <span className="vx-ts-chart__legend-dot" style={{ background: p.color }} />
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Data-availability note — explains WHY older parts of a wide range look empty, instead
          of leaving the user to wonder if the date-range selector is broken. */}
      {coverageNotes.length > 0 && (
        <div className="vx-ts-chart__data-note" role="note">
          {coverageNotes.map(n => (
            <div key={n.label}>
              {n.label}: data is only available from {formatDate(n.from)} onward for this metric —
              the platform doesn’t provide history from before that.
            </div>
          ))}
        </div>
      )}

      {/* SVG chart */}
      <div className="vx-ts-chart__canvas">
        {!hasAnyData && (
          <div className="vx-ts-chart__empty-state" role="status">
            No data recorded yet for this date range.
          </div>
        )}
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          viewBox={`0 0 800 ${height}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="vx-ts-chart__svg"
        >
          {/* Grid lines */}
          {yTicks.map(tick => {
            const y = yScale(tick);
            return (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={800 - PADDING.right}
                  y2={y}
                  className="vx-ts-chart__grid-line"
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 4}
                  className="vx-ts-chart__y-label"
                >
                  {formatValue(tick)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {dates.map((date, i) => {
            if (i % labelEvery !== 0 && i !== dates.length - 1) return null;
            return (
              <text
                key={date}
                x={xScale(i, 800)}
                y={height - 8}
                className="vx-ts-chart__x-label"
              >
                {formatDate(date)}
              </text>
            );
          })}

          {/* Data lines */}
          {series.map(s => (
            <path
              key={s.id}
              d={buildPath(s.values, 800)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="vx-ts-chart__line"
            />
          ))}

          {/* Isolated-point markers — a lone value (both neighbours are gaps) can't draw a line,
              so render a dot so single data points are still visible. */}
          {series.map(s => s.values.map((v, i) => {
            if (v === null) return null;
            const prev = i > 0 ? s.values[i - 1] : null;
            const next = i < s.values.length - 1 ? s.values[i + 1] : null;
            if (prev !== null || next !== null) return null; // part of a line segment
            return (
              <circle
                key={`${s.id}-pt-${i}`}
                cx={xScale(i, 800)}
                cy={yScale(v)}
                r={3.5}
                fill={s.color}
                className="vx-ts-chart__point-dot"
              />
            );
          }))}

          {/* Data dots (on hover date) — skip platforms with no data at this date */}
          {tooltip && series.map(s => {
            const v = s.values[tooltip.idx];
            if (v === null) return null;
            return (
              <circle
                key={s.id}
                cx={xScale(tooltip.idx, 800)}
                cy={yScale(v)}
                r={4}
                fill={s.color}
                stroke="#fff"
                strokeWidth={2}
                className="vx-ts-chart__dot"
              />
            );
          })}

          {/* Vertical hover guide */}
          {tooltip && (
            <line
              x1={xScale(tooltip.idx, 800)}
              y1={PADDING.top}
              x2={xScale(tooltip.idx, 800)}
              y2={height - PADDING.bottom}
              className="vx-ts-chart__hover-line"
            />
          )}
        </svg>

        {/* Tooltip — positioned as a % of width (viewBox is stretched) with 1:1 height */}
        {tooltip && (
          <div
            className="vx-ts-chart__tooltip"
            style={{
              left: `${(xScale(tooltip.idx, 800) / 800) * 100}%`,
              top: `${yScale(tooltip.value)}px`,
            }}
          >
            <div className="vx-ts-chart__tooltip-date">{formatDate(tooltip.date)}</div>
            <div className="vx-ts-chart__tooltip-platform">{tooltip.platform}</div>
            <div className="vx-ts-chart__tooltip-value">{formatValue(tooltip.value)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeSeriesChart;
