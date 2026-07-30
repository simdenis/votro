-- Migration 050: clear the categories the "auto" substring bug got wrong, and
-- the ones that had no category to land in, so Haiku can redo them.
--
-- Two problems, one visible symptom.
--
-- 1. camera_scraper._CATEGORY_RULES had a bare `auto` in the Transport pattern,
--    so every title containing "autorizarea", "autorităţilor", "Autoritatea",
--    "Autonome", "autoexcludere" or "autoconsumului" was filed under Transport.
--    46 of the 65 Transport laws (71%) were wrong — including L230/2026, a law
--    about how mayors get elected.
--
-- 2. There was no electoral category at all, so laws on elections, referendums
--    and party financing had nowhere to land: they ended up scattered across
--    Administraţie, Transport, Economie and Justiţie.
--
-- The regex is fixed in camera_scraper.py and "Electoral" is added to
-- categorize_laws.py. This migration only sets the affected rows back to NULL —
-- categorize_laws.py fills NULLs and nothing else, so it is the re-classifier.
--
--   AFTER running this:  python scraper/categorize_laws.py
--
-- Idempotent: re-running only re-clears rows that are still wrong.

-- ── 1. release the titles the buggy `auto` rule captured ────────────────────
-- Only Transport rows, and only where the title has no genuine transport word.
UPDATE laws
SET law_category = NULL
WHERE law_category = 'Transport'
  AND title !~* 'transport|trafic|circulaţi|circulaț|vehicul'
                '|autovehicul|autoturism|autobuz|autocar|automobil|autoutilitar'
                '|auto-?şcoal|auto-?școal|rutier|drum|feroviar';

-- ── 2. release the electoral laws so they can become 'Electoral' ────────────
-- These are currently split across Administraţie / Transport / Economie /
-- Justiţie — none of which is the topic a reader is looking for. Titles are
-- matched on specific electoral phrases, not a bare "alegere" (which also
-- appears in "libera alegere a medicului" and similar).
UPDATE laws
SET law_category = NULL
WHERE law_category IS DISTINCT FROM 'Electoral'
  AND title ~* 'electoral|referendum'
               '|alegerea Senatului|alegerea Camerei|alegerea autorit'
               '|alegerea Preşedintelui|alegerea Președintelui'
               '|alegeri locale|alegeri parlamentare|alegeri prezidenţiale|alegeri prezidențiale|alegeri europarlamentare'
               '|aleşilor locali|aleșilor locali'
               '|partidelor politice|partide politice';
