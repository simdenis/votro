-- 059: plain-language explainers (scraper/law_explainer.py). laws.summary says
-- which articles a bill touches; the explainer says what changes for people,
-- read from the FINAL text (forma promulgată), never from the initiators' claims:
--   {"titlu", "ce_se_schimba": [{"inainte", "acum"}], "pe_cine_afecteaza", "de_cand", "neclar"}
-- explainer_source = the law text read (fp | lp | fs | fg), "+em" when the
-- expunere de motive was read too.

ALTER TABLE laws
  ADD COLUMN IF NOT EXISTS explainer            jsonb,
  ADD COLUMN IF NOT EXISTS explainer_source     text,
  ADD COLUMN IF NOT EXISTS explainer_model      text,
  ADD COLUMN IF NOT EXISTS explainer_checked_at timestamptz;

COMMENT ON COLUMN laws.explainer IS
  'AI explainer from the final law text: titlu, ce_se_schimba[{inainte,acum}], pe_cine_afecteaza, de_cand, neclar';
COMMENT ON COLUMN laws.explainer_source IS
  'law text the explainer read: fp | lp | fs | fg, +em when the expunere de motive was read too';
