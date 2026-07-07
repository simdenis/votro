-- 021: real presence — participated votes / votes held since mandate start.
--
-- The old presence divided by the member's OWN recorded rows, but sources
-- don't list absentees consistently: senat.ro only sometimes (Darău: 12 rows
-- in 19 months, real activity = 1 vote), cdep.ro never (deputies all showed
-- ~100%). Profiles carry the validation date ("validat în data de 21.12.2024" /
-- "data validării: 21 decembrie 2024") — the roster scraper now stores it, and
-- presence becomes: rows where the member appears (incl. not_voted, excl.
-- absent) / all chamber votes since GREATEST(mandate_start, first vote in DB).
-- Fallback when mandate_start is null: the member's first recorded vote date.

alter table public.politicians add column if not exists mandate_start date;

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
        ), 0)
        * 100, 1
    )) as presence_pct,
    pol.active,
    pol.county
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'senate'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start,
         pol.active, pol.county, p.id, p.name, p.abbreviation, p.color;

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
        ), 0)
        * 100, 1
    )) as presence_pct,
    pol.active,
    pol.county
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'deputies'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start,
         pol.active, pol.county, p.id, p.name, p.abbreviation, p.color;
