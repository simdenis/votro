-- VotRO Migration 002: Frontend preparation
-- Adds outcome/color/category columns, new aggregate views, RLS + anon grants

-- ============================================================
-- 1. New columns
-- ============================================================
ALTER TABLE votes ADD COLUMN IF NOT EXISTS outcome TEXT
    CHECK (outcome IN ('adoptat', 'respins'));

ALTER TABLE parties ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE laws ADD COLUMN IF NOT EXISTS law_category TEXT;

-- ============================================================
-- 2. Backfill votes.outcome from stored counts
--    Romanian parliament: motion passes when for_count > against_count.
--    This is an approximation; supermajority edge cases are rare.
-- ============================================================
UPDATE votes
SET outcome = CASE
    WHEN for_count IS NOT NULL AND against_count IS NOT NULL
         AND for_count > against_count THEN 'adoptat'
    WHEN for_count IS NOT NULL AND against_count IS NOT NULL THEN 'respins'
    ELSE NULL
END
WHERE outcome IS NULL;

-- ============================================================
-- 3. Party colors
-- ============================================================
UPDATE parties SET color = '#e8112d' WHERE abbreviation = 'PSD';
UPDATE parties SET color = '#ffdd00' WHERE abbreviation = 'PNL';
UPDATE parties SET color = '#0073c6' WHERE abbreviation = 'USR';
UPDATE parties SET color = '#002B7F' WHERE abbreviation = 'AUR';
UPDATE parties SET color = '#2e7d32' WHERE abbreviation = 'UDMR';
UPDATE parties SET color = '#ff6600' WHERE abbreviation = 'PIR';
UPDATE parties SET color = '#9e9e9e' WHERE abbreviation = 'IND';

-- ============================================================
-- 4. New views
-- ============================================================

-- Per-vote, per-party, per-choice breakdown (used in vote detail chart)
CREATE OR REPLACE VIEW party_vote_breakdown AS
SELECT
    pv.vote_id,
    p.id            AS party_id,
    p.name          AS party_name,
    p.abbreviation  AS party_abbr,
    COALESCE(p.color, '#9e9e9e') AS party_color,
    pv.vote_choice,
    COUNT(*)        AS count
FROM politician_votes pv
JOIN politicians pol ON pol.id = pv.politician_id
JOIN parties     p   ON p.id  = pol.party_id
GROUP BY pv.vote_id, p.id, p.name, p.abbreviation, p.color, pv.vote_choice;

-- Per-senator aggregate stats (used in senator list + profile)
CREATE OR REPLACE VIEW senator_stats AS
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
GROUP BY pol.id, pol.name, pol.first_name, p.id, p.name, p.abbreviation, p.color;

-- Per-party cohesion (used in party page + dashboard)
CREATE OR REPLACE VIEW party_cohesion AS
SELECT
    p.id                            AS party_id,
    p.name,
    p.abbreviation,
    COALESCE(p.color, '#9e9e9e')    AS color,
    COUNT(DISTINCT pv.vote_id)      AS votes_participated,
    COUNT(pv.*) FILTER (WHERE pv.vote_choice IN ('for','against','abstention')) AS total_active_votes,
    COUNT(pv.*) FILTER (WHERE pv.party_line_deviation = FALSE
                           AND pv.vote_choice IN ('for','against','abstention')) AS with_party_votes,
    COUNT(pv.*) FILTER (WHERE pv.party_line_deviation = TRUE) AS deviation_count,
    ROUND(
        COUNT(pv.*) FILTER (WHERE pv.party_line_deviation = FALSE
                               AND pv.vote_choice IN ('for','against','abstention'))::NUMERIC
        / NULLIF(COUNT(pv.*) FILTER (WHERE pv.vote_choice IN ('for','against','abstention')), 0)
        * 100, 1
    ) AS cohesion_pct
FROM parties p
LEFT JOIN politicians pol ON pol.party_id = p.id
LEFT JOIN politician_votes pv ON pv.politician_id = pol.id
GROUP BY p.id, p.name, p.abbreviation, p.color;

-- Per-party majority vote position per law/vote (used in party vote history)
CREATE OR REPLACE VIEW party_majority_votes AS
WITH ranked AS (
    SELECT
        pvb.*,
        ROW_NUMBER() OVER (
            PARTITION BY pvb.vote_id, pvb.party_id
            ORDER BY pvb.count DESC
        ) AS rn
    FROM party_vote_breakdown pvb
)
SELECT
    r.vote_id,
    r.party_id,
    r.party_name,
    r.party_abbr,
    r.party_color,
    r.vote_choice   AS majority_choice,
    r.count         AS majority_count,
    v.vote_date,
    v.outcome,
    l.code          AS law_code,
    l.title         AS law_title
FROM ranked r
JOIN votes v ON v.id = r.vote_id
JOIN laws  l ON l.id = v.law_id
WHERE r.rn = 1;

-- ============================================================
-- 5. Security invoker on views (so RLS on base tables is respected)
-- ============================================================
ALTER VIEW public.deviations           SET (security_invoker = true);
ALTER VIEW public.party_vote_breakdown SET (security_invoker = true);
ALTER VIEW public.party_majority_votes SET (security_invoker = true);
ALTER VIEW public.party_vote_summary   SET (security_invoker = true);
ALTER VIEW public.party_cohesion       SET (security_invoker = true);
ALTER VIEW public.senator_stats        SET (security_invoker = true);

-- ============================================================
-- 6. RLS — enable on all tables
-- ============================================================
ALTER TABLE parties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians      ENABLE ROW LEVEL SECURITY;
ALTER TABLE laws             ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE politician_votes ENABLE ROW LEVEL SECURITY;

-- Read-only anon policies
CREATE POLICY "anon_read" ON parties          FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON politicians      FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON laws             FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON votes            FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON politician_votes FOR SELECT TO anon USING (true);

-- ============================================================
-- 7. Grant SELECT on tables + all views to anon
-- ============================================================
GRANT SELECT ON parties             TO anon;
GRANT SELECT ON politicians         TO anon;
GRANT SELECT ON laws                TO anon;
GRANT SELECT ON votes               TO anon;
GRANT SELECT ON politician_votes    TO anon;
GRANT SELECT ON party_vote_summary  TO anon;
GRANT SELECT ON deviations          TO anon;
GRANT SELECT ON party_vote_breakdown  TO anon;
GRANT SELECT ON senator_stats         TO anon;
GRANT SELECT ON party_cohesion        TO anon;
GRANT SELECT ON party_majority_votes  TO anon;
