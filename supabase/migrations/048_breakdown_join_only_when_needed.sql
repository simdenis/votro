-- 048: stop paying for the fallback join on every row (tuning for 047).
--
-- 047 reads the group a vote was cast with, falling back to the member's current
-- party for rows written before 045:
--
--     join politicians pol on pol.id = pv.politician_id
--     join parties     p   on p.id  = coalesce(pv.party_id, pol.party_id)
--
-- That fallback needs politicians on EVERY row — a second pass over all 351k
-- politician_votes — even though the backfill has left zero rows needing it, and
-- both scrapers now write party_id at insert time, so the count can only ever be
-- the handful a future vote page fails to label.
--
-- Make the join fire only for the rows that actually need it. Same result, and
-- strictly less work than the pre-047 view, which always joined politicians.
--
-- Kept as a LEFT JOIN with the condition inside the ON clause, not a WHERE: a row
-- whose party_id is set must survive even though it matches no politicians row
-- under that condition.

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
left join politicians pol
       on pol.id = pv.politician_id
      and pv.party_id is null
join parties p on p.id = coalesce(pv.party_id, pol.party_id)
group by pv.vote_id, p.id, p.name, p.abbreviation, p.color, pv.vote_choice;
