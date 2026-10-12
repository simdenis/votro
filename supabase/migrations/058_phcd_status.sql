-- 058: a PHCD is the Camera's own resolution (hotărâre a Camerei Deputaților):
-- final after its single Camera vote, it never goes to the Senate. The view
-- classified all 129 of them as 'asteapta_senat', so /legi listed them in
-- «purgatoriu» and cards showed ÎN DEZBATERE next to «Adoptată». Same view as
-- 054, only the status CASE changes — `create or replace` keeps dependents.
create or replace view public.law_status with (security_invoker = true) as
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
  l.motivare_initiatori,
  l.summary_source,
  l.em_url,
  l.bill_pdf_url,
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
    when l.code ~* '^PH ?CD' and c.id is not null then 'complet'
    when s.id is not null and c.id is null     then 'asteapta_camera'
    when s.id is null     and c.id is not null then 'asteapta_senat'
    else 'necunoscut'
  end as status
from laws l
inner join (select distinct law_id from votes where law_id is not null) lv on lv.law_id = l.id
left join ranked s on s.law_id = l.id and s.chamber = 'senate'   and s.rn = 1
left join ranked c on c.law_id = l.id and c.chamber = 'deputies' and c.rn = 1;

grant select on public.law_status to anon;
