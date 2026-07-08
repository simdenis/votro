-- 024: let the site read politician_party_history.
--
-- The table has RLS enabled but no policy — GRANT SELECT alone (migration 010)
-- isn't enough, so the anon key saw 0 of its 516 rows and the "Parcurs
-- politic" profile card had nothing to render. 57 party switches were
-- recorded by the Senate scraper and invisible.

drop policy if exists "anon_read" on public.politician_party_history;
create policy "anon_read" on public.politician_party_history
  for select to anon using (true);
