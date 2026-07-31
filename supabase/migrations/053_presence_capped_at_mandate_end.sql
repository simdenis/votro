-- 053: stop the presence denominator at mandate_end.
--
-- The denominator ran from mandate_start to TODAY for everyone, so a member
-- who left kept accumulating "chamber votes held" they could not possibly
-- attend — Afloarei (10 days in office, resigned 2024-12-31) showed
-- "absență 100% (1/990)". With mandate_end (migration 051) the window closes
-- at departure; for sitting members mandate_end is NULL and nothing changes.
--
-- Views re-created verbatim from 033 with one added condition in both
-- denominator subqueries + mandate_end in GROUP BY.

create or replace view public.senator_stats with (security_invoker = true) as
select
    pol.id                          as politician_id,
    pol.name,
    pol.first_name,
    p.id                            as party_id,
    p.name                          as party_name,
    p.abbreviation                  as party_abbr,
    coalesce(p.color, '#9e9e9e')    as party_color,
    count(pv.*)                     as total_votes,
    count(pv.*) filter (where pv.vote_choice = 'for')           as votes_for,
    count(pv.*) filter (where pv.vote_choice = 'against')       as votes_against,
    count(pv.*) filter (where pv.vote_choice = 'abstention')    as votes_abstention,
    count(pv.*) filter (where pv.vote_choice in ('absent', 'not_voted')) as votes_absent,
    count(pv.*) filter (where pv.party_line_deviation = true)   as deviations,
    round(
        count(pv.*) filter (where pv.party_line_deviation = true)::numeric
        / nullif(count(pv.*) filter (where pv.vote_choice in ('for','against','abstention')), 0)
        * 100, 1
    ) as deviation_pct,
    least(100.0, round(
        count(pv.*) filter (where pv.vote_choice in ('for','against','abstention','not_voted'))::numeric
        / nullif((
            select count(*) from public.votes v2
            where v2.chamber = pol.chamber
              and v2.vote_date >= coalesce(pol.mandate_start, min(v.vote_date))
              and (pol.mandate_end is null or v2.vote_date <= pol.mandate_end)
        ), 0)
        * 100, 1
    )) as presence_pct,
    pol.active,
    pol.county,
    pol.gov_role,
    count(pv.*) filter (where pv.vote_choice = 'not_voted') as votes_not_voted,
    (
        select count(*) from public.votes v2
        where v2.chamber = pol.chamber
          and v2.vote_date >= coalesce(pol.mandate_start, min(v.vote_date))
          and (pol.mandate_end is null or v2.vote_date <= pol.mandate_end)
    ) as chamber_votes,
    pol.context_note,
    pol.context_note_url
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'senate'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start, pol.mandate_end,
         pol.active, pol.county, pol.gov_role, pol.context_note, pol.context_note_url,
         p.id, p.name, p.abbreviation, p.color;

create or replace view public.deputy_stats with (security_invoker = true) as
select
    pol.id                          as politician_id,
    pol.name,
    pol.first_name,
    p.id                            as party_id,
    p.name                          as party_name,
    p.abbreviation                  as party_abbr,
    coalesce(p.color, '#9e9e9e')    as party_color,
    count(pv.*)                     as total_votes,
    count(pv.*) filter (where pv.vote_choice = 'for')           as votes_for,
    count(pv.*) filter (where pv.vote_choice = 'against')       as votes_against,
    count(pv.*) filter (where pv.vote_choice = 'abstention')    as votes_abstention,
    count(pv.*) filter (where pv.vote_choice in ('absent', 'not_voted')) as votes_absent,
    count(pv.*) filter (where pv.party_line_deviation = true)   as deviations,
    round(
        count(pv.*) filter (where pv.party_line_deviation = true)::numeric
        / nullif(count(pv.*) filter (where pv.vote_choice in ('for','against','abstention')), 0)
        * 100, 1
    ) as deviation_pct,
    least(100.0, round(
        count(pv.*) filter (where pv.vote_choice in ('for','against','abstention','not_voted'))::numeric
        / nullif((
            select count(*) from public.votes v2
            where v2.chamber = pol.chamber
              and v2.vote_date >= coalesce(pol.mandate_start, min(v.vote_date))
              and (pol.mandate_end is null or v2.vote_date <= pol.mandate_end)
        ), 0)
        * 100, 1
    )) as presence_pct,
    pol.active,
    pol.county,
    pol.gov_role,
    count(pv.*) filter (where pv.vote_choice = 'not_voted') as votes_not_voted,
    (
        select count(*) from public.votes v2
        where v2.chamber = pol.chamber
          and v2.vote_date >= coalesce(pol.mandate_start, min(v.vote_date))
          and (pol.mandate_end is null or v2.vote_date <= pol.mandate_end)
    ) as chamber_votes,
    pol.context_note,
    pol.context_note_url
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'deputies'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start, pol.mandate_end,
         pol.active, pol.county, pol.gov_role, pol.context_note, pol.context_note_url,
         p.id, p.name, p.abbreviation, p.color;
