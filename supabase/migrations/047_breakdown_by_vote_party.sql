-- 047: same fix as 046, for the view that feeds the whole analytics chain.
--
-- party_cohesion was the visible case, but party_vote_breakdown (002) has the
-- identical defect and a much wider blast radius:
--
--     FROM politician_votes pv
--     JOIN politicians pol ON pol.id = pv.politician_id
--     JOIN parties     p   ON p.id  = pol.party_id     -- the party they are in NOW
--
-- Everything downstream inherits it:
--     party_vote_breakdown  →  party_majority_votes (002)
--                           →  party_agreement (029/030, materialized)  →  /analize
--
-- So the pairwise agreement matrix is computed from vote breakdowns attributed
-- to today's memberships, and every individual vote page shows how "each party
-- voted" using labels the members only acquired later. A vote from March cast by
-- a PSD member who has since moved is counted, retroactively, as a vote by their
-- new group — in a breakdown that is supposed to reproduce what the chamber's
-- own page printed that day.
--
-- 045 records the group each vote was actually cast with; this reads it. Rows
-- not yet backfilled fall back to the current party, i.e. exactly today's
-- behaviour, so the view is correct-or-unchanged at every point of the backfill.
--
-- party_agreement is MATERIALIZED: it keeps serving the old numbers until
-- refresh_matviews.py runs (daily, from run_daily.sh) or refresh_party_agreement()
-- is called directly.

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
join politicians pol on pol.id = pv.politician_id
join parties     p   on p.id  = coalesce(pv.party_id, pol.party_id)
group by pv.vote_id, p.id, p.name, p.abbreviation, p.color, pv.vote_choice;

-- CREATE OR REPLACE keeps the view's options and grants, so unlike 046 there is
-- nothing to re-apply here. Stated explicitly because dropping this one would
-- cascade into party_majority_votes and party_agreement.
