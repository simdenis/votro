-- Migration 015: estimated participation rate per politician.
-- Denominator is the number of votes held in the politician's OWN chamber between
-- their first and last recorded vote (a tenure proxy — avoids penalising members
-- who joined mid-term). Numerator is the votes they actively cast (for/against/
-- abstention). This is an ESTIMATE: our vote history is incomplete and absences
-- aren't always listed at the source, so treat it as a lower-bound participation.

CREATE OR REPLACE VIEW politician_participation
WITH (security_invoker = true) AS
WITH bounds AS (
  SELECT
    pv.politician_id,
    pol.chamber,
    MIN(v.vote_date) AS first_date,
    MAX(v.vote_date) AS last_date,
    COUNT(*) FILTER (WHERE pv.vote_choice IN ('for', 'against', 'abstention')) AS active_votes
  FROM politician_votes pv
  JOIN votes v        ON v.id  = pv.vote_id
  JOIN politicians pol ON pol.id = pv.politician_id
  GROUP BY pv.politician_id, pol.chamber
)
SELECT
  b.politician_id,
  b.active_votes,
  (SELECT COUNT(*) FROM votes v2
     WHERE v2.chamber = b.chamber
       AND v2.vote_date BETWEEN b.first_date AND b.last_date) AS window_total,
  ROUND(
    100.0 * b.active_votes
    / NULLIF((SELECT COUNT(*) FROM votes v2
                WHERE v2.chamber = b.chamber
                  AND v2.vote_date BETWEEN b.first_date AND b.last_date), 0)
  )::int AS participation_pct
FROM bounds b;

GRANT SELECT ON politician_participation TO anon;
