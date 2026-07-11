-- Interestingness score for post selection (Gemini-rated, 1-100).
-- interest_reason keeps the model's one-line justification — it doubles as
-- caption inspiration; interest_checked_at stops re-scoring failures forever.
ALTER TABLE laws
  ADD COLUMN IF NOT EXISTS interest_score smallint,
  ADD COLUMN IF NOT EXISTS interest_reason text,
  ADD COLUMN IF NOT EXISTS interest_checked_at timestamptz;

COMMENT ON COLUMN laws.interest_score IS 'Public-interest score 1-100 (Gemini, interest_scorer.py) — post selection signal';
