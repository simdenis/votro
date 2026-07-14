-- 028: analytics views for /analize
--
-- The page needs three aggregates that are expensive to compute over the full
-- legislature client-side (party_majority_votes is ~15k rows). Push them into
-- views so the page reads tiny result sets and the build stays fast.

-- Contested votes: minority camp (FOR vs AGAINST+ABSTAIN) ≥ 20% of votes cast.
-- Same definition as party_cohesion (migration 027).
CREATE OR REPLACE VIEW contested_votes AS
SELECT id
FROM votes
WHERE for_count IS NOT NULL AND against_count IS NOT NULL
  AND LEAST(for_count, against_count + COALESCE(abstention_count, 0)) * 5
      >= for_count + against_count + COALESCE(abstention_count, 0);

-- Pairwise party agreement on contested votes: how often two parties' majority
-- landed on the same choice. Symmetric, emitted once per pair (a < b).
CREATE OR REPLACE VIEW party_agreement AS
SELECT
    a.party_abbr AS party_a,
    b.party_abbr AS party_b,
    COUNT(*)                                                          AS shared,
    COUNT(*) FILTER (WHERE a.majority_choice = b.majority_choice)     AS agreed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.majority_choice = b.majority_choice)
          / COUNT(*), 0)                                             AS agreement_pct
FROM party_majority_votes a
JOIN party_majority_votes b
  ON a.vote_id = b.vote_id AND a.party_abbr < b.party_abbr
WHERE a.vote_id IN (SELECT id FROM contested_votes)
  AND a.majority_choice IN ('for', 'against', 'abstention')
  AND b.majority_choice IN ('for', 'against', 'abstention')
GROUP BY a.party_abbr, b.party_abbr
HAVING COUNT(*) >= 5;

-- Monthly plenary attendance per chamber: present_count over chamber seats.
CREATE OR REPLACE VIEW monthly_attendance AS
SELECT
    TO_CHAR(vote_date, 'YYYY-MM') AS month,
    chamber,
    ROUND(AVG(LEAST(100.0, present_count::NUMERIC
        / CASE chamber WHEN 'senate' THEN 134 ELSE 331 END * 100)), 0) AS attendance_pct,
    COUNT(*) AS votes
FROM votes
WHERE present_count IS NOT NULL
GROUP BY 1, 2;

-- Decided votes with a real quorum, exposing the margin for a "closest" sort.
CREATE OR REPLACE VIEW closest_votes AS
SELECT
    v.id, v.vote_date, v.chamber, v.for_count, v.against_count,
    ABS(v.for_count - v.against_count) AS margin,
    l.code  AS law_code,
    l.title AS law_title
FROM votes v
LEFT JOIN laws l ON l.id = v.law_id
WHERE v.outcome IS NOT NULL
  AND v.for_count IS NOT NULL AND v.against_count IS NOT NULL
  AND v.present_count >= 100;

ALTER VIEW contested_votes    SET (security_invoker = true);
ALTER VIEW party_agreement    SET (security_invoker = true);
ALTER VIEW monthly_attendance SET (security_invoker = true);
ALTER VIEW closest_votes      SET (security_invoker = true);

GRANT SELECT ON contested_votes    TO anon;
GRANT SELECT ON party_agreement    TO anon;
GRANT SELECT ON monthly_attendance TO anon;
GRANT SELECT ON closest_votes      TO anon;
