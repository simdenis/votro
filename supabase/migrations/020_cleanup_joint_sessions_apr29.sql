-- 020: joint-session pollution, round two (same disease as migration 012).
--
-- cdep votes 36934 ("Ordinea de zi") and 36935 ("Programul de lucru") on
-- 2026-04-29 were ședințe comune Camera+Senat, scraped before the CD+SE
-- guard existed. They created 81 ghost "deputies" rows for senators (lowercase
-- names, e.g. "Titus Corlăţean" next to the real senate row "CORLĂŢEAN"),
-- which showed up twice in search. The scraper now also skips any nominal
-- page labeled "Sedinta: comuna ..." as defense in depth.
--
-- Applied via REST on 2026-07-06; kept here for the record.

-- Step 1: the two joint votes (politician_votes cascade)
DELETE FROM public.votes
WHERE cdep_vote_id IN (36934, 36935);

-- Step 2: inactive "deputies" with no votes left — senators' ghost rows.
-- (Legitimate deputies all have votes; roster-inserted members are active.)
DELETE FROM public.politicians
WHERE chamber = 'deputies'
  AND active = false
  AND id NOT IN (SELECT DISTINCT politician_id FROM public.politician_votes);
