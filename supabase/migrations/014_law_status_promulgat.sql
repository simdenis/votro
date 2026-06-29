-- Migration 014: a promulgated/forwarded/CCR-referred law is past Parliament —
-- don't classify it as "asteapta_camera"/"asteapta_senat" just because we lack
-- one chamber's plenary vote (tacit adoption, or vote not yet scraped).
-- presidential_status now takes priority in the computed status.

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
  -- Status — presidential outcome wins; otherwise derive from chamber votes
  CASE
    WHEN l.presidential_status = 'promulgat'   THEN 'promulgat'
    WHEN l.presidential_status = 'retrimis'    THEN 'retrimis'
    WHEN l.presidential_status = 'sesizat_ccr' THEN 'sesizat_ccr'
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
