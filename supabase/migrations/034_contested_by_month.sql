-- 034: contested-vote counts per chamber per month.
--
-- Feeds the /analize "Cine votează cu cine" footer: the matrix aggregates
-- contested votes over the slider's window, and this lets it show HOW MANY
-- laws went into the calculation, split Senat / Cameră. Tiny result (~chambers
-- × months), plain view — computed on read over the ~2k votes, no refresh.
-- Same contested definition as contested_votes / party_cohesion (migration 027).

CREATE OR REPLACE VIEW contested_votes_by_month AS
SELECT
    chamber,
    TO_CHAR(vote_date, 'YYYY-MM') AS month,
    COUNT(*)                      AS n
FROM votes
WHERE for_count IS NOT NULL AND against_count IS NOT NULL
  AND LEAST(for_count, against_count + COALESCE(abstention_count, 0)) * 5
      >= for_count + against_count + COALESCE(abstention_count, 0)
GROUP BY chamber, TO_CHAR(vote_date, 'YYYY-MM');

ALTER VIEW contested_votes_by_month SET (security_invoker = true);
GRANT SELECT ON contested_votes_by_month TO anon;
