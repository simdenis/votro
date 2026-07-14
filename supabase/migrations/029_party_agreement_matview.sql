-- 029: make party_agreement a materialized view
--
-- The pairwise self-join on party_majority_votes (itself a windowed view over
-- ~900k politician_votes rows) is too heavy for the anon 8s statement timeout,
-- so the /analize matrix timed out. The matrix only changes when new votes land,
-- so precompute it: a materialized view reads instantly and is refreshed by the
-- daily scrape (run_daily.sh: REFRESH MATERIALIZED VIEW party_agreement).

DROP VIEW IF EXISTS party_agreement;

CREATE MATERIALIZED VIEW party_agreement AS
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

GRANT SELECT ON party_agreement TO anon;

-- Refresh entry point for the daily scrape. SECURITY DEFINER + a raised
-- statement_timeout so the heavy self-join completes; only service_role may
-- call it (refresh is expensive — never expose to anon).
CREATE OR REPLACE FUNCTION refresh_party_agreement() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET statement_timeout = '180s' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW party_agreement;
END;
$$;
GRANT EXECUTE ON FUNCTION refresh_party_agreement() TO service_role;
