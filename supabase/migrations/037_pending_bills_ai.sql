-- 037: AI fields for pending (tacit-term) bills — closes the "tacit top-10 by
-- hotness" gap: until now the tacit ranking could only sort by deadline.
-- Filled by scraper/pending_bills_scorer.py (Gemini reads pdf_url — the
-- expunere de motive — and returns summary + interest score in one call).

ALTER TABLE pending_bills
  ADD COLUMN IF NOT EXISTS summary          text,
  ADD COLUMN IF NOT EXISTS interest_score   int,
  ADD COLUMN IF NOT EXISTS interest_reason  text,
  ADD COLUMN IF NOT EXISTS ai_checked_at    timestamptz;

COMMENT ON COLUMN pending_bills.interest_score IS
  'Gemini public-interest score 1-100, same rubric as laws.interest_score';
