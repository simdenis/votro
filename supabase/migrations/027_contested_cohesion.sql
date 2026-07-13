-- VotRO Migration 027: cohesion counted on contested votes only
--
-- Cohesion over ALL plenary votes is structurally inflated: most votes are
-- procedural or near-unanimous, so every party lands in 86–99% and the
-- number carries no information. Standard fix in legislative studies
-- (Public Whip counts rebellions only on divided votes): restrict the
-- metric to contested votes.
--
-- A vote is "contested" when the minority camp — FOR vs AGAINST+ABSTAIN
-- (abstention opposes adoption in the Romanian parliament) — gathered at
-- least 20% of the votes cast.
--
-- Column set is unchanged; votes_participated / total_active_votes /
-- with_party_votes / deviation_count / cohesion_pct now refer to contested
-- votes only.

DROP VIEW IF EXISTS party_cohesion;

CREATE VIEW party_cohesion AS
WITH contested AS (
    SELECT id
    FROM votes
    WHERE for_count IS NOT NULL AND against_count IS NOT NULL
      -- minority * 5 >= total  ⇔  minority >= 20% of votes cast
      AND LEAST(for_count, against_count + COALESCE(abstention_count, 0)) * 5
          >= for_count + against_count + COALESCE(abstention_count, 0)
)
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
LEFT JOIN politician_votes pv
       ON pv.politician_id = pol.id
      AND pv.vote_id IN (SELECT id FROM contested)
GROUP BY p.id, p.name, p.abbreviation, p.color;

ALTER VIEW public.party_cohesion SET (security_invoker = true);
GRANT SELECT ON party_cohesion TO anon;
