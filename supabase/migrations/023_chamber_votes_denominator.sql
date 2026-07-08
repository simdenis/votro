-- 023: expose the real absence denominator in the stats views.
--
-- The profile's behavior card divided "absent" by the member's RECORDED rows
-- (Anisie: 9/179 = 5%) while the list divides by all chamber votes since
-- mandate validation (56%) — the sources don't list every absentee, so
-- recorded 'absent' rows massively undercount. The views now expose:
--   chamber_votes    — plenary votes held in the member's chamber since
--                      GREATEST(mandate_start, first vote in DB) — the same
--                      denominator presence_pct already uses
--   votes_not_voted  — present-but-didn't-press rows (previously lumped into
--                      votes_absent)
-- True absences = chamber_votes − (for + against + abstention + not_voted).
-- Columns are appended, so CREATE OR REPLACE keeps existing column order.

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
    pol.county,
    pol.gov_role,
    count(pv.*) filter (where pv.vote_choice = 'not_voted') as votes_not_voted,
    (
        select count(*) from public.votes v2
        where v2.chamber = pol.chamber
          and v2.vote_date >= coalesce(pol.mandate_start, min(v.vote_date))
    ) as chamber_votes
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'senate'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start,
         pol.active, pol.county, pol.gov_role, p.id, p.name, p.abbreviation, p.color;

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
    pol.county,
    pol.gov_role,
    count(pv.*) filter (where pv.vote_choice = 'not_voted') as votes_not_voted,
    (
        select count(*) from public.votes v2
        where v2.chamber = pol.chamber
          and v2.vote_date >= coalesce(pol.mandate_start, min(v.vote_date))
    ) as chamber_votes
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'deputies'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start,
         pol.active, pol.county, pol.gov_role, p.id, p.name, p.abbreviation, p.color;
