-- 051: when and why a mandate ended — feeds the "Foști parlamentari" page.
-- Filled by roster_scraper from the cdep profile line
-- "data încetării mandatului: 31 decembrie 2024 - demisie - HCD nr.2/2025".
-- senat.ro exposes no equivalent, so ended senators keep NULLs (the page
-- shows the period as "… – mandat încheiat" without a date).

ALTER TABLE politicians
  ADD COLUMN IF NOT EXISTS mandate_end        date,
  ADD COLUMN IF NOT EXISTS mandate_end_reason text;

COMMENT ON COLUMN politicians.mandate_end_reason IS
  'cdep''s own word for it: demisie / deces / incompatibilitate…';
