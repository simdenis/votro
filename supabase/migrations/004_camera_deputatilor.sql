-- Migration 004: Camera Deputaților support
-- Adds chamber column to votes, cdep_vote_id dedup key,
-- fixes UNIQUE constraint to allow same law voted by both chambers,
-- and filters existing views to senate only.

-- ============================================================
-- 1. Add chamber + cdep dedup key to votes
-- ============================================================
ALTER TABLE votes ADD COLUMN IF NOT EXISTS chamber chamber DEFAULT 'senate';
ALTER TABLE votes ADD COLUMN IF NOT EXISTS cdep_vote_id INTEGER UNIQUE;

-- Backfill existing senate rows
UPDATE votes SET chamber = 'senate' WHERE chamber IS NULL;

-- ============================================================
-- 2. Fix UNIQUE constraint to include chamber
--    (same law can be voted by both chambers on same day)
-- ============================================================
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_law_id_vote_date_vote_type_key;
ALTER TABLE votes ADD CONSTRAINT votes_law_id_vote_date_vote_type_chamber_key
    UNIQUE (law_id, vote_date, vote_type, chamber);

-- ============================================================
-- 3. Filter senator_stats view to senate politicians only
-- ============================================================
CREATE OR REPLACE VIEW senator_stats WITH (security_invoker = true) AS
SELECT
    pol.id                          AS politician_id,
    pol.name,
    pol.first_name,
    p.id                            AS party_id,
    p.name                          AS party_name,
    p.abbreviation                  AS party_abbr,
    COALESCE(p.color, '#9e9e9e')    AS party_color,
    COUNT(pv.*)                     AS total_votes,
    COUNT(pv.*) FILTER (WHERE pv.vote_choice = 'for')           AS votes_for,
    COUNT(pv.*) FILTER (WHERE pv.vote_choice = 'against')       AS votes_against,
    COUNT(pv.*) FILTER (WHERE pv.vote_choice = 'abstention')    AS votes_abstention,
    COUNT(pv.*) FILTER (WHERE pv.vote_choice IN ('absent', 'not_voted')) AS votes_absent,
    COUNT(pv.*) FILTER (WHERE pv.party_line_deviation = TRUE)   AS deviations,
    ROUND(
        COUNT(pv.*) FILTER (WHERE pv.party_line_deviation = TRUE)::NUMERIC
        / NULLIF(COUNT(pv.*) FILTER (WHERE pv.vote_choice IN ('for','against','abstention')), 0)
        * 100, 1
    ) AS deviation_pct
FROM politicians pol
JOIN parties p ON p.id = pol.party_id
LEFT JOIN politician_votes pv ON pv.politician_id = pol.id
WHERE pol.chamber = 'senate'
GROUP BY pol.id, pol.name, pol.first_name, p.id, p.name, p.abbreviation, p.color;

-- ============================================================
-- 4. Add cdep_vote_id index
-- ============================================================
CREATE INDEX IF NOT EXISTS votes_cdep_vote_id_idx ON votes(cdep_vote_id) WHERE cdep_vote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS votes_chamber_idx ON votes(chamber);

-- ============================================================
-- 5. Grant on updated view
-- ============================================================
GRANT SELECT ON senator_stats TO anon;
