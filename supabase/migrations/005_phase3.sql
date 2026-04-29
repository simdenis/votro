-- Migration 005: Phase 3 — performance indexes
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE throughout).

-- ── politicians.chamber index (speeds up senator_stats view filter) ──
CREATE INDEX IF NOT EXISTS politicians_chamber_idx ON politicians(chamber);

-- ── votes.scraped_at ──────────────────────────────────────────────────
ALTER TABLE votes ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ DEFAULT NOW();

-- ── politician_votes composite indexes ───────────────────────────────
-- (politician_id, vote_id) already covered by the UNIQUE constraint index.
-- Add (vote_id, vote_choice) for breakdown queries.
CREATE INDEX IF NOT EXISTS pv_vote_choice_idx ON politician_votes(vote_id, vote_choice);

-- ── votes freshness index ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS votes_scraped_at_idx ON votes(scraped_at DESC);
