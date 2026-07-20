-- 039: a short, catchy plain-language headline for each law — the eye-catching
-- hero on the IG "Pe scurt" card and the hook readers actually stop for
-- ("Cum s-a votat legea împotriva uciderii femeilor"). The official title is
-- jargon; the summary is a paragraph. This is the one-line grab.
-- Filled by interest_scorer.py (Gemini, alongside the interest score).

ALTER TABLE laws ADD COLUMN IF NOT EXISTS headline text;

COMMENT ON COLUMN laws.headline IS
  'AI catchy one-line headline (≤ ~12 words, plain Romanian, no code) for cards';
