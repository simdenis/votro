-- Migration 013: Plain-language law summary from the explanatory memo (expunere de motive)
-- No AI — text is extracted from the senat.ro EM PDF (...EM.PDF) and stored as-is,
-- only when clean enough (a quality gate lives in scraper/law_summarizer.py).

-- ── 1. New columns on laws ────────────────────────────────────────────
ALTER TABLE laws
  ADD COLUMN IF NOT EXISTS summary            TEXT,         -- scop paragraph from the EM, plain text
  ADD COLUMN IF NOT EXISTS em_url             TEXT,         -- link to the full expunere de motive PDF
  ADD COLUMN IF NOT EXISTS summary_checked_at TIMESTAMPTZ;  -- set after each attempt, so we don't reprocess

-- ── 2. Rebuild law_status view to expose summary + em_url ─────────────
DROP VIEW IF EXISTS law_status;
CREATE VIEW law_status WITH (security_invoker = true) AS
WITH ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY law_id, chamber
      ORDER BY
        CASE WHEN lower(vote_type) LIKE '%final%' THEN 0 ELSE 1 END,
        vote_date DESC
    ) AS rn
  FROM votes
  WHERE law_id IS NOT NULL
)
SELECT
  l.id               AS law_id,
  l.code,
  l.title,
  l.law_category,
  l.summary,
  l.em_url,
  l.presidential_status,
  l.presidential_date,
  l.ccr_decision,
  l.ccr_date,
  -- Senate
  s.id               AS senate_vote_id,
  s.vote_date        AS senate_vote_date,
  s.outcome          AS senate_outcome,
  s.for_count        AS senate_for,
  s.against_count    AS senate_against,
  s.abstention_count AS senate_abstentions,
  -- Camera
  c.id               AS camera_vote_id,
  c.vote_date        AS camera_vote_date,
  c.outcome          AS camera_outcome,
  c.for_count        AS camera_for,
  c.against_count    AS camera_against,
  c.abstention_count AS camera_abstentions,
  -- Status
  CASE
    WHEN s.id IS NOT NULL AND c.id IS NOT NULL THEN 'complet'
    WHEN s.id IS NOT NULL AND c.id IS NULL     THEN 'asteapta_camera'
    WHEN s.id IS NULL     AND c.id IS NOT NULL THEN 'asteapta_senat'
    ELSE 'necunoscut'
  END AS status
FROM laws l
INNER JOIN (SELECT DISTINCT law_id FROM votes WHERE law_id IS NOT NULL) lv ON lv.law_id = l.id
LEFT JOIN ranked s ON s.law_id = l.id AND s.chamber = 'senate'   AND s.rn = 1
LEFT JOIN ranked c ON c.law_id = l.id AND c.chamber = 'deputies' AND c.rn = 1;

GRANT SELECT ON law_status TO anon;
