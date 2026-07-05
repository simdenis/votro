-- 018: active mandates + county, scraper heartbeat, tacit-deadline bills.
--
-- 1) politicians.active/county — the table keeps everyone who ever voted this
--    legislature (415 "deputies" vs the real 335), which inflated seat counts
--    and absentee math. A roster scraper marks who currently holds a mandate
--    and records their electoral constituency (county).
-- 2) scrape_meta — heartbeat written at the end of every scraper run, so the
--    footer can distinguish "parliament idle" from "scraper broken".
-- 3) pending_bills — bills at the first chamber with a running constitutional
--    term (art. 75) and their official tacit-adoption deadline, from cdep's
--    "Verificare termene legale" page.

alter table politicians add column if not exists active boolean not null default true;
alter table politicians add column if not exists county text;

create table if not exists scrape_meta (
    key         text primary key,
    value       text,
    updated_at  timestamptz not null default now()
);
alter table scrape_meta enable row level security;
drop policy if exists "anon_read" on scrape_meta;
create policy "anon_read" on scrape_meta for select to anon using (true);

-- senator_stats/deputy_stats gain active + county (appended after the 009
-- columns — CREATE OR REPLACE keeps existing order) so lists and the county
-- page can filter current mandates without extra joins.
create or replace view senator_stats with (security_invoker = true) as
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
    round(
        count(pv.*) filter (where pv.vote_choice in ('for','against','abstention','not_voted'))::numeric
        / nullif(count(pv.*), 0)
        * 100, 1
    ) as presence_pct,
    pol.active,
    pol.county
from politicians pol
join parties p on p.id = pol.party_id
left join politician_votes pv on pv.politician_id = pol.id
where pol.chamber = 'senate'
group by pol.id, pol.name, pol.first_name, p.id, p.name, p.abbreviation, p.color;

create or replace view deputy_stats with (security_invoker = true) as
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
    round(
        count(pv.*) filter (where pv.vote_choice in ('for','against','abstention','not_voted'))::numeric
        / nullif(count(pv.*), 0)
        * 100, 1
    ) as presence_pct,
    pol.active,
    pol.county
from politicians pol
join parties p on p.id = pol.party_id
left join politician_votes pv on pv.politician_id = pol.id
where pol.chamber = 'deputies'
group by pol.id, pol.name, pol.first_name, p.id, p.name, p.abbreviation, p.color;

create table if not exists pending_bills (
    id             uuid primary key default gen_random_uuid(),
    code           text unique not null,          -- registry number, e.g. "BP186/2026"
    title          text,
    chamber        text not null default 'deputies',  -- first chamber the term runs in
    committee      text,
    term_days      text,                          -- "45" / "45 prelungit la 60 zile"
    tacit_deadline date,
    source_url     text,
    scraped_at     timestamptz not null default now()
);
alter table pending_bills enable row level security;
drop policy if exists "anon_read" on pending_bills;
create policy "anon_read" on pending_bills for select to anon using (true);
