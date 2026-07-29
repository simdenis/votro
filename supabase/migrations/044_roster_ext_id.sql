-- 044: stable per-chamber roster id on politicians, so a renamed member is
-- recognised instead of being replaced.
--
-- roster_scraper matches roster entries to DB rows by name tokens. That is fine
-- until a member's surname changes: the roster entry matches nothing and gets
-- INSERTED as a new politician, while the old row matches nothing and gets
-- DEACTIVATED — one person split into two rows, votes stranded on the dead one.
--
-- This happened on 2026-07-28: "Geamănu Aurora-Adela" (PSD Dolj, 886 votes)
-- became "Cotea Aurora-Adela" on cdep. The new row was created with 0 of 960
-- votes, which reads as 100% absence — it would have topped the monthly
-- absence card. Both rows shared party, county and validation date (21 Dec
-- 2024) because they are one mandate: cdep idm=116.
--
-- Both chambers publish a stable numeric id and we already fetch it — cdep as
-- `idm` in structura2015.mp?idm=NNN, senat.ro as `ParlamentarID`. Neither was
-- ever stored for deputies (senators keep theirs inside senat_profile_url).
-- One text column serves both; uniqueness is per chamber because the two
-- registries number independently.

alter table politicians add column if not exists ext_id text;

comment on column politicians.ext_id is
  'Stable roster id from the chamber''s own registry: cdep idm (deputies) or '
  'senat.ro ParlamentarID (senate). Set by roster_scraper; the match key that '
  'survives a name change. NULL until the roster has seen the member once.';

-- Partial: rows without an id yet must not collide with each other.
create unique index if not exists politicians_chamber_ext_id_key
  on politicians (chamber, ext_id)
  where ext_id is not null;
