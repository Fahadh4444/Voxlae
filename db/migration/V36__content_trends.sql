-- Content Trends (influencer trend suggestions).
--
-- One row per trending topic, ingested daily from free sources (YouTube, Reddit,
-- Google Trends) or seeded. The reach engine ranks these per creator using their
-- niche -> category, region and (optional) audience age. Hashtags live in a child
-- table grouped as core / niche / reach.

CREATE TABLE IF NOT EXISTS content_trends (
    id             BIGSERIAL PRIMARY KEY,
    source         VARCHAR(20)  NOT NULL,                 -- YOUTUBE | REDDIT | GOOGLE_TRENDS | SEED
    category       VARCHAR(32)  NOT NULL,                 -- fitness | tech | food | ...
    region         VARCHAR(8)   NOT NULL DEFAULT 'GLOBAL',-- IN | US | GLOBAL | ...
    timeframe      VARCHAR(8)   NOT NULL DEFAULT 'WEEK',  -- DAY | WEEK
    topic          VARCHAR(200) NOT NULL,
    summary        VARCHAR(400),
    momentum_score INT          NOT NULL DEFAULT 50,      -- 0..100, how fast it is climbing
    sample_title   VARCHAR(300),
    sample_url     VARCHAR(600),
    thumbnail_url  VARCHAR(600),
    age_band       VARCHAR(16),                           -- e.g. 18-24 (nullable)
    external_id    VARCHAR(200),                          -- source id, for future dedup
    fetched_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_content_trend UNIQUE (source, category, region, topic)
);

CREATE INDEX IF NOT EXISTS idx_content_trends_cat_region
    ON content_trends (category, region, timeframe);

CREATE TABLE IF NOT EXISTS content_trend_hashtags (
    trend_id BIGINT      NOT NULL REFERENCES content_trends(id) ON DELETE CASCADE,
    hashtag  VARCHAR(80) NOT NULL,
    grp      VARCHAR(12) NOT NULL DEFAULT 'core'          -- core | niche | reach
);

CREATE INDEX IF NOT EXISTS idx_content_trend_hashtags_trend
    ON content_trend_hashtags (trend_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed trends so the feature is populated on day one (before the ingestion job
-- has API keys). Marked source = 'SEED'; real ingestion adds/updates alongside.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO content_trends (source, category, region, timeframe, topic, summary, momentum_score, sample_title, age_band) VALUES
  ('SEED','fitness','GLOBAL','WEEK','"75 Hard" challenge check-ins','Daily progress + accountability content is spiking again as the new-year cohort ramps.',86,'I tried 75 Hard for 30 days — honest results','18-24'),
  ('SEED','fitness','GLOBAL','WEEK','15-minute mobility routines','Short, equipment-free mobility and stretching routines are outperforming long workouts.',74,'15 min morning mobility (do this daily)','18-34'),
  ('SEED','fitness','IN','WEEK','Home protein on a budget (India)','High-protein Indian meals under ₹100 — strong regional search interest.',68,'Cheap high-protein Indian meals','18-34'),
  ('SEED','tech','GLOBAL','WEEK','AI tools that actually save time','Practical "I use this every day" AI tool roundups are climbing fast.',88,'7 AI tools I actually use in 2026','18-34'),
  ('SEED','tech','GLOBAL','WEEK','Budget phone camera tests','Side-by-side camera comparisons on sub-$300 phones are trending.',71,'Best budget phone camera right now',NULL),
  ('SEED','tech','GLOBAL','DAY','Local-first / offline apps','Interest in privacy-friendly, offline-capable apps is rising this week.',64,'Why I switched to offline apps','25-34'),
  ('SEED','food','GLOBAL','WEEK','High-protein snack recipes','Quick, macro-friendly snack recipes are a reliable reach driver right now.',79,'5 high-protein snacks in 10 minutes','18-34'),
  ('SEED','food','IN','WEEK','One-pot regional meals','Fast one-pot Indian recipes are seeing strong regional momentum.',70,'One-pot dinner in 20 minutes',NULL),
  ('SEED','beauty','GLOBAL','WEEK','"Clean girl" everyday routine','Minimal, natural-look routines continue to trend across short-form.',77,'My 5-minute clean-girl routine','18-24'),
  ('SEED','beauty','GLOBAL','WEEK','Skincare myths debunked','Dermatologist-style myth-busting content is climbing.',66,'Skincare myths you still believe','18-34'),
  ('SEED','finance','GLOBAL','WEEK','First salary money moves','"What to do with your first paycheck" explainers are trending with Gen Z.',82,'Do these 5 things with your first salary','18-24'),
  ('SEED','finance','IN','WEEK','SIP vs FD, explained simply','Beginner-friendly Indian investing explainers have strong search demand.',69,'SIP vs FD — which is better?','18-34'),
  ('SEED','comedy','GLOBAL','DAY','Relatable "POV" skits','Short POV/relatable skits remain a top short-form format this week.',75,'POV: your first day at work',NULL),
  ('SEED','education','GLOBAL','WEEK','Study-with-me / focus routines','Focus, deep-work and study-with-me content is rising into exam season.',72,'2-hour study with me (lofi)','18-24'),
  ('SEED','general','GLOBAL','WEEK','Day-in-the-life, but useful','"Day in the life" that teaches one concrete thing is outperforming pure vlogs.',63,'A day in my life (with 3 tips)',NULL),
  ('SEED','general','GLOBAL','WEEK','"I tried it so you don''t have to"','Test-and-review framing continues to drive reach across niches.',67,'I tried it for 7 days',NULL)
ON CONFLICT ON CONSTRAINT uq_content_trend DO NOTHING;

-- Hashtags for the seeded trends (core = broad, niche = category, reach = trend-specific).
INSERT INTO content_trend_hashtags (trend_id, hashtag, grp)
SELECT id, tag, grp FROM content_trends t
CROSS JOIN LATERAL (
    VALUES
      ('#'||replace(lower(t.category),' ',''), 'niche'),
      ('#trending', 'core'),
      ('#reels', 'core'),
      ('#shorts', 'core')
) AS h(tag, grp)
WHERE t.source = 'SEED'
ON CONFLICT DO NOTHING;

-- A few reach-specific hashtags per category.
INSERT INTO content_trend_hashtags (trend_id, hashtag, grp)
SELECT id, tag, 'reach' FROM content_trends t
CROSS JOIN LATERAL (
    SELECT CASE t.category
        WHEN 'fitness'   THEN ARRAY['#fittok','#homeworkout','#fitnessmotivation']
        WHEN 'tech'      THEN ARRAY['#techtok','#ai','#gadgets']
        WHEN 'food'      THEN ARRAY['#foodie','#recipe','#easyrecipes']
        WHEN 'beauty'    THEN ARRAY['#skincare','#makeup','#grwm']
        WHEN 'finance'   THEN ARRAY['#personalfinance','#investing','#moneytips']
        WHEN 'comedy'    THEN ARRAY['#comedy','#pov','#relatable']
        WHEN 'education' THEN ARRAY['#studytok','#studygram','#learnontiktok']
        ELSE ARRAY['#creator','#contentcreator','#viral']
    END AS tags
) c
CROSS JOIN LATERAL unnest(c.tags) AS tag
WHERE t.source = 'SEED'
ON CONFLICT DO NOTHING;
