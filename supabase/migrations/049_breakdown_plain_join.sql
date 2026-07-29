-- 049: drop the fallback join entirely — plain equijoin on the recorded party.
--
-- 047 introduced coalesce(pv.party_id, pol.party_id) so the view stayed correct
-- while the backfill ran. 048 tried to make that fallback cheap by firing it only
-- for rows that need it. Neither is fast enough: refreshing party_agreement_monthly
-- went from completing inside the daily run to over 125s, because the whole-set
-- plan changed — per-vote queries against the same views still return in ~0.3s,
-- so it is the planner's shape for the full aggregation, not the data volume.
--
-- The fallback has no work left to do. The backfill attributed all 351,339 rows,
-- and both scrapers now write party_id at insert time, so the only rows that could
-- arrive without one are those a future vote page fails to label. Join straight to
-- the recorded party: a plain equijoin on a column with an index (045), and one
-- fewer table than even the pre-047 view, which always joined politicians.
--
-- The risk this trades away is silence: a row with no party_id now drops out of
-- the breakdown instead of falling back. That is exactly the kind of quiet loss
-- that should be loud, so validate.py gains an invariant for it — if the count is
-- ever non-zero the daily run says so, and the fallback can come back knowing what
-- it is for.

create or replace view party_vote_breakdown as
select
    pv.vote_id,
    p.id            as party_id,
    p.name          as party_name,
    p.abbreviation  as party_abbr,
    coalesce(p.color, '#9e9e9e') as party_color,
    pv.vote_choice,
    count(*)        as count
from politician_votes pv
join parties p on p.id = pv.party_id
group by pv.vote_id, p.id, p.name, p.abbreviation, p.color, pv.vote_choice;
