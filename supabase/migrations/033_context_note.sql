-- 033: curator context note for absences.
--
-- Absence rankings ("Absențe — top 5") have no defense mechanism: an MP who is
-- #1 because of a documented concediu medical, maternitate or delegație oficială
-- is a story about US, not them. This adds an optional per-MP note (with a source
-- URL) that the profile shows next to the absence figure and the ranking flags
-- with a marker. gov_role already covers ministers (structural absence); this is
-- for everything else that a raw presence_pct can't explain.

alter table public.politicians
  add column if not exists context_note     text,
  add column if not exists context_note_url text;

comment on column public.politicians.context_note is
  'Curator note explaining a documented/structural absence (medical leave, official delegation, etc.). Shown verbatim on the profile.';

-- Re-create both stats views (from migration 023) with the two note columns
-- appended. New columns go at the end so CREATE OR REPLACE keeps column order.

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
    ) as chamber_votes,
    pol.context_note,
    pol.context_note_url
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'senate'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start,
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
    ) as chamber_votes,
    pol.context_note,
    pol.context_note_url
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'deputies'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start,
         pol.active, pol.county, pol.gov_role, pol.context_note, pol.context_note_url,
         p.id, p.name, p.abbreviation, p.color;
