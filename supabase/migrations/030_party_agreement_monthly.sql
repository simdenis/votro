-- 030: monthly party-agreement buckets (enables an arbitrary time window)
--
-- Replaces the whole-legislature party_agreement matview with a per-month
-- breakdown. Any date window is then a cheap client-side sum of its months —
-- no re-running the heavy self-join per filter. Still a materialized view
-- (the self-join over ~900k politician_votes rows is too heavy to run live).

DROP MATERIALIZED VIEW IF EXISTS party_agreement;
DROP MATERIALIZED VIEW IF EXISTS party_agreement_monthly;

CREATE MATERIALIZED VIEW party_agreement_monthly AS
SELECT
    a.party_abbr                     AS party_a,
    b.party_abbr                     AS party_b,
    TO_CHAR(a.vote_date, 'YYYY-MM')  AS month,
    COUNT(*)                                                      AS shared,
    COUNT(*) FILTER (WHERE a.majority_choice = b.majority_choice) AS agreed
FROM party_majority_votes a
JOIN party_majority_votes b
  ON a.vote_id = b.vote_id AND a.party_abbr < b.party_abbr
WHERE a.vote_id IN (SELECT id FROM contested_votes)
  AND a.majority_choice IN ('for', 'against', 'abstention')
  AND b.majority_choice IN ('for', 'against', 'abstention')
GROUP BY a.party_abbr, b.party_abbr, TO_CHAR(a.vote_date, 'YYYY-MM');

GRANT SELECT ON party_agreement_monthly TO anon;

-- Same refresh entry point (name kept so run_daily doesn't change); now
-- refreshes the monthly matview.
CREATE OR REPLACE FUNCTION refresh_party_agreement() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET statement_timeout = '180s' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW party_agreement_monthly;
END;
$$;
GRANT EXECUTE ON FUNCTION refresh_party_agreement() TO service_role;
