-- Migration 007: deputy_stats view
-- Mirrors senator_stats exactly, filtered to chamber = 'deputies'.

CREATE OR REPLACE VIEW deputy_stats WITH (security_invoker = true) AS
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
WHERE pol.chamber = 'deputies'
GROUP BY pol.id, pol.name, pol.first_name, p.id, p.name, p.abbreviation, p.color;

GRANT SELECT ON deputy_stats TO anon;
