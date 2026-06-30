-- Diacritic-insensitive search.
--
-- Adds normalised, lower-cased, unaccented generated columns to `politicians`
-- and `laws`, so search can match "soaca" → "Șoșoacă", "tariceanu" → "Tăriceanu".
-- Generated STORED columns compute for existing rows immediately and stay in
-- sync automatically — no scraper changes or backfill needed.

create extension if not exists unaccent;

-- unaccent() is STABLE; wrap it as IMMUTABLE so it can be used in a generated
-- column (standard pattern — the 'unaccent' dictionary doesn't change at runtime).
create or replace function f_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  strict
as $$ select lower(unaccent('unaccent', $1)) $$;

alter table politicians
  add column if not exists search_name text
  generated always as (
    f_unaccent(coalesce(first_name, '') || ' ' || coalesce(name, ''))
  ) stored;

alter table laws
  add column if not exists search_text text
  generated always as (
    f_unaccent(coalesce(title, '') || ' ' || coalesce(code, '') || ' ' || coalesce(law_category, ''))
  ) stored;
