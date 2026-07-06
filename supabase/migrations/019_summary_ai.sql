-- 019: mark AI-generated law summaries so the frontend can label them.
--
-- The extractive summarizer produced nothing (senat.ro expunere-de-motive PDFs
-- have garbled OCR text layers). We now summarize the PDF natively with an LLM
-- in plain Romanian. Transparency requires labeling these as machine-written,
-- with a link to the official source PDF (laws.em_url).
alter table public.laws add column if not exists summary_is_ai boolean not null default false;

-- law_status lists columns explicitly, so expose the new flag through it.
-- (Recreated verbatim from migration 014 with l.summary_is_ai added.)
drop view if exists public.law_status;
create view public.law_status with (security_invoker = true) as
with ranked as (
  select *,
    row_number() over (
      partition by law_id, chamber
      order by
        case when lower(vote_type) like '%final%' then 0 else 1 end,
        vote_date desc
    ) as rn
  from public.votes
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
from public.laws l
inner join (select distinct law_id from public.votes where law_id is not null) lv on lv.law_id = l.id
left join ranked s on s.law_id = l.id and s.chamber = 'senate'   and s.rn = 1
left join ranked c on c.law_id = l.id and c.chamber = 'deputies' and c.rn = 1;

grant select on public.law_status to anon;
