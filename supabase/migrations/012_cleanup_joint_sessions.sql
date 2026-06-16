-- Migration 012: Clean up joint session pollution
-- Votes 36936, 36937, 36938 (May 5 2026) were ședinte comune Camera+Senat.
-- The scraper incorrectly recorded senators as deputies.

-- Step 1: delete politician_votes for the 3 joint session votes
DELETE FROM politician_votes
WHERE vote_id IN (
    SELECT id FROM votes WHERE cdep_vote_id IN (36936, 36937, 36938)
);

-- Step 2: delete "deputy" politicians who have zero politician_votes
-- and were created on or after the joint session date (likely senators)
DELETE FROM politicians
WHERE chamber = 'deputies'
  AND created_at >= '2026-05-05'
  AND id NOT IN (SELECT DISTINCT politician_id FROM politician_votes);
