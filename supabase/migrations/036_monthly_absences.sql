-- 036: per-politician monthly absences (materialized — politician_votes is the
-- big table; ~464 members × months is a tiny result but the scan is not).
--
-- Powers: admin "top 10 absenți pe ultima lună" section + future site page.
-- Absence = (votes the member's chamber held that month) − (their
-- participations). Display fields are denormalized so readers need no joins.
-- Refreshed daily from the VPS via refresh_matviews.py (same pattern as
-- party_agreement, migration 029).

DROP MATERIALIZED VIEW IF EXISTS politician_monthly_absences;
CREATE MATERIALIZED VIEW politician_monthly_absences AS
WITH held AS (
    SELECT chamber, TO_CHAR(vote_date, 'YYYY-MM') AS month, COUNT(*) AS held
    FROM votes
    GROUP BY 1, 2
),
part AS (
    SELECT pv.politician_id, v.chamber, TO_CHAR(v.vote_date, 'YYYY-MM') AS month,
           COUNT(*) AS present
    FROM politician_votes pv
    JOIN votes v ON v.id = pv.vote_id
    GROUP BY 1, 2, 3
)
SELECT
    p.id                                   AS politician_id,
    p.name,
    p.first_name,
    p.chamber,
    pa.abbreviation                        AS party_abbr,
    pa.color                               AS party_color,
    p.active,
    p.gov_role,
    p.context_note,
    p.mandate_start,
    h.month,
    h.held,
    COALESCE(pt.present, 0)                AS present,
    h.held - COALESCE(pt.present, 0)       AS absent,
    ROUND((h.held - COALESCE(pt.present, 0))::NUMERIC / h.held * 100, 0) AS absence_pct
FROM politicians p
JOIN held h  ON h.chamber = p.chamber
LEFT JOIN part pt ON pt.politician_id = p.id AND pt.month = h.month AND pt.chamber = p.chamber
LEFT JOIN parties pa ON pa.id = p.party_id
WHERE h.held > 0;

CREATE UNIQUE INDEX ON politician_monthly_absences (politician_id, month);

GRANT SELECT ON politician_monthly_absences TO anon;

-- Same SECURITY DEFINER refresh pattern as refresh_party_agreement (029).
CREATE OR REPLACE FUNCTION refresh_monthly_absences()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    REFRESH MATERIALIZED VIEW politician_monthly_absences;
$$;

REVOKE ALL ON FUNCTION refresh_monthly_absences() FROM public;
GRANT EXECUTE ON FUNCTION refresh_monthly_absences() TO service_role;
