-- 057: initiatives — every filed parliamentary initiative, including the ones
-- that never reached a plenary vote (stuck in committee). One initiative = one
-- row carrying both registry codes: the Camera leg (PLx…, cdep.ro) and the
-- Senate leg (L…, senat.ro), linked via the cdep fișă cross-reference.
--
-- stage is the normalized current position; stage_raw keeps the official
-- wording it was derived from. in_comisie / raport_depus / ordinea_zi are
-- reserved for the FIRST chamber (no plenary decision anywhere yet — the
-- "fără vot în plen" filter reads exactly these three); once the first
-- chamber decides (vote or tacit), the row moves to adoptat_prima /
-- respins_prima / la_decizionala and onward.

create table if not exists initiatives (
    id              uuid primary key default gen_random_uuid(),
    cdep_code       text unique,          -- "PLx425/2026" (laws-table convention)
    senat_code      text unique,          -- "L108/2026"
    cdep_idp        int,                  -- cdep fișă id (upl_pck2015.proiect?idp=)
    title           text,
    obiect          text,                 -- "Obiect de reglementare" — official plain description
    registered_date date,                 -- first registration in either chamber
    chamber_first   text check (chamber_first in ('senate', 'deputies')),
    stage_raw       text,                 -- official stage wording (cdep listing / senat Stadiu)
    stage           text check (stage in (
                        'in_comisie', 'raport_depus', 'ordinea_zi',
                        'adoptat_prima', 'respins_prima', 'la_decizionala',
                        'adoptat_final', 'respins_definitiv',
                        'procedura_incetata', 'retras', 'la_ccr', 'promulgat')),
    stage_date      date,
    committee_since date,                 -- current "trimis pentru raport" date (clock for zile fără raport)
    law_category    text,
    law_id          uuid references laws(id) on delete set null,
    scraped_at      timestamptz not null default now(),
    check (cdep_code is not null or senat_code is not null)
);

create index if not exists initiatives_stage_idx on initiatives(stage);
create index if not exists initiatives_registered_idx on initiatives(registered_date);

alter table initiatives enable row level security;
drop policy if exists "anon_read" on initiatives;
create policy "anon_read" on initiatives for select to anon using (true);
