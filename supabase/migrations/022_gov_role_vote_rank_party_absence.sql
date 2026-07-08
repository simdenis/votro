-- 022: government roles, law_status vote ranking, party absence.
--
-- 1) politicians.gov_role — MPs serving in the Government ('premier',
--    'vicepremier', 'ministru') never vote; without the label they look like
--    chronic absentees (Darău: minister of Economy, showed as the laziest
--    senator). The shame corner used gt(presence_pct, 0) as a proxy — now it
--    filters gov_role IS NULL. Seeded manually from the Bolojan cabinet;
--    update when the government changes.
-- 2) law_status ranked the two same-day Camera votes on PL-x 229/2026
--    arbitrarily and picked the amendment vote (10-179 "respins") over the
--    final vote (205-2 "adoptat") — the law showed "rejected by Camera" yet
--    promulgated. Votes now rank: final > plain > amendment/procedural.
--    (camera_scraper now writes vote_type; backfill_vote_types.py fills
--    historic rows.)
-- 3) party_absence — average plenary absence of a party's active,
--    non-government members, both chambers.

alter table public.politicians add column if not exists gov_role text;

-- Bolojan cabinet members holding a parliamentary mandate (July 2026).
update public.politicians set gov_role = 'premier'
 where chamber = 'senate' and unaccent(name) ilike '%bolojan%';
update public.politicians set gov_role = 'vicepremier'
 where chamber = 'senate' and unaccent(name) ilike '%predoiu%';
update public.politicians set gov_role = 'vicepremier'
 where chamber = 'senate' and unaccent(name) ilike '%tanczos%';
update public.politicians set gov_role = 'ministru'
 where chamber = 'senate' and unaccent(name) ilike '%cseke%'
   and unaccent(first_name) ilike '%attila%';
update public.politicians set gov_role = 'ministru'
 where chamber = 'senate' and unaccent(name) ilike '%darau%'
   and unaccent(first_name) ilike '%irineu%';
update public.politicians set gov_role = 'vicepremier'
 where chamber = 'deputies' and unaccent(name) ilike '%miruta%'
   and unaccent(first_name) ilike '%radu%';
update public.politicians set gov_role = 'ministru'
 where chamber = 'deputies' and unaccent(name) ilike '%toiu%'
   and unaccent(first_name) ilike '%oana%';
update public.politicians set gov_role = 'ministru'
 where chamber = 'deputies' and unaccent(name) ilike '%buzoianu%'
   and unaccent(first_name) ilike '%diana%';

-- Data fix: L131/2025's title was overwritten with a Camera amendment-vote
-- subject before the scraper stripped that boilerplate.
update public.laws
   set title = 'pentru modificarea art.597 alin.(2), (2 1 ) şi (8) din Legea nr.135/2010 privind Codul de procedură penală'
 where code = 'L131/2025' and title like 'PL-x%Amendament%';

-- ── senator_stats / deputy_stats + gov_role (appended) ─────────────────
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
    pol.gov_role
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
    pol.gov_role
from public.politicians pol
join public.parties p on p.id = pol.party_id
left join public.politician_votes pv on pv.politician_id = pol.id
left join public.votes v on v.id = pv.vote_id
where pol.chamber = 'deputies'
group by pol.id, pol.name, pol.first_name, pol.chamber, pol.mandate_start,
         pol.active, pol.county, pol.gov_role, p.id, p.name, p.abbreviation, p.color;

-- ── law_status: rank final > plain > amendment/procedural ──────────────
drop view if exists public.law_status;
create view public.law_status with (security_invoker = true) as
with ranked as (
  select *,
    row_number() over (
      partition by law_id, chamber
      order by
        case
          when lower(coalesce(vote_type, '')) like '%final%' then 0
          when lower(coalesce(vote_type, ''))
               ~ '(amendament|retrimitere|procedur|ordinea de zi|prelungire)' then 2
          else 1
        end,
        vote_date desc
    ) as rn
  from votes
  where law_id is not null
)
select
  l.id               as law_id,
  l.code,
  l.title,
  l.law_category,
  l.summary,
  l.summary_is_ai,
  l.em_url,
  l.presidential_status,
  l.presidential_date,
  l.ccr_decision,
  l.ccr_date,
  s.id               as senate_vote_id,
  s.vote_date        as senate_vote_date,
  s.outcome          as senate_outcome,
  s.for_count        as senate_for,
  s.against_count    as senate_against,
  s.abstention_count as senate_abstentions,
  c.id               as camera_vote_id,
  c.vote_date        as camera_vote_date,
  c.outcome          as camera_outcome,
  c.for_count        as camera_for,
  c.against_count    as camera_against,
  c.abstention_count as camera_abstentions,
  case
    when l.presidential_status = 'promulgat'   then 'promulgat'
    when l.presidential_status = 'retrimis'    then 'retrimis'
    when l.presidential_status = 'sesizat_ccr' then 'sesizat_ccr'
    when s.id is not null and c.id is not null then 'complet'
    when s.id is not null and c.id is null     then 'asteapta_camera'
    when s.id is null     and c.id is not null then 'asteapta_senat'
    else 'necunoscut'
  end as status
from laws l
inner join (select distinct law_id from votes where law_id is not null) lv on lv.law_id = l.id
left join ranked s on s.law_id = l.id and s.chamber = 'senate'   and s.rn = 1
left join ranked c on c.law_id = l.id and c.chamber = 'deputies' and c.rn = 1;

grant select on public.law_status to anon;

-- ── party_absence: mean absence of active, non-government members ──────
create or replace view public.party_absence with (security_invoker = true) as
with members as (
  select party_id, presence_pct from public.senator_stats
   where active and gov_role is null and presence_pct is not null
  union all
  select party_id, presence_pct from public.deputy_stats
   where active and gov_role is null and presence_pct is not null
)
select
  p.id                         as party_id,
  p.name,
  p.abbreviation,
  coalesce(p.color, '#9e9e9e') as color,
  count(m.*)                   as member_count,
  round(avg(100 - m.presence_pct), 1) as absence_pct
from public.parties p
join members m on m.party_id = p.id
group by p.id, p.name, p.abbreviation, p.color;

grant select on public.party_absence to anon;
