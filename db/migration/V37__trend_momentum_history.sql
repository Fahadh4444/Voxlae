-- Daily category momentum history — powers the "momentum over time" line chart.
-- One row per (category, region, day); recomputed after each ingestion from the
-- current content_trends. Category-level (not per-topic) so the series is stable
-- even though individual trending topics churn daily.

CREATE TABLE IF NOT EXISTS content_category_momentum (
    category      VARCHAR(32) NOT NULL,
    region        VARCHAR(8)  NOT NULL,
    snapshot_date DATE        NOT NULL,
    avg_momentum  INT         NOT NULL DEFAULT 0,
    trend_count   INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (category, region, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_category_momentum_region_date
    ON content_category_momentum (region, snapshot_date);

-- Seed one day of history from the seeded trends so the chart isn't empty on day one.
INSERT INTO content_category_momentum (category, region, snapshot_date, avg_momentum, trend_count)
SELECT category, region, CURRENT_DATE, round(avg(momentum_score))::int, count(*)
FROM content_trends
GROUP BY category, region
ON CONFLICT (category, region, snapshot_date) DO NOTHING;
