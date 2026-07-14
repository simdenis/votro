-- 032: fix the politician slug translate map
--
-- Migration 031's TO string had a stray extra char, shifting every mapping
-- after position 5 (ş→t, ţ→s, á→t …) so slugs read "motteanu" / "guta" /
-- "zolttn". Generated-column expressions can't be ALTERed, so drop + re-add
-- with the corrected 22-char TO. Must stay identical to lib/utils SLUG_TO.

ALTER TABLE politicians DROP COLUMN IF EXISTS slug;

ALTER TABLE politicians ADD COLUMN slug text
GENERATED ALWAYS AS (
  btrim(
    regexp_replace(
      translate(
        lower(coalesce(first_name, '') || ' ' || coalesce(name, '')),
        'ăâîșțşţáàäéèêíóòöőúùüű',
        'aaiststaaaeeeioooouuuu'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
) STORED;

CREATE INDEX IF NOT EXISTS politicians_slug_idx ON politicians (slug);
