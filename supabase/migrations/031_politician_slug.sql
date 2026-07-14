-- 031: human URL slug for politicians (/senatori/victor-viorel-ponta)
--
-- Generated column so it's always in sync. Uses translate() (IMMUTABLE — unlike
-- unaccent, which can't be used in a generated column) to fold Romanian +
-- common Hungarian diacritics to ASCII, then dashes the rest. The frontend's
-- personSlug() in lib/utils MUST use the identical FROM/TO maps and regex, so
-- a generated link always matches the stored slug (no 404s).
--
-- 471 current MPs → 471 unique slugs (0 collisions). If two MPs ever share a
-- name the slugs collide; the lookup takes the first — acceptable for now.

ALTER TABLE politicians ADD COLUMN IF NOT EXISTS slug text
GENERATED ALWAYS AS (
  btrim(
    regexp_replace(
      translate(
        lower(coalesce(first_name, '') || ' ' || coalesce(name, '')),
        'ăâîșțşţáàäéèêíóòöőúùüű',
        'aaisttstaaaeeeioooouuuu'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
) STORED;

CREATE INDEX IF NOT EXISTS politicians_slug_idx ON politicians (slug);
