-- Migration 011: Fix garbled party abbreviations from camera scraper
-- "P"  was PSD(afiliat) → merge politicians into PSD, delete bogus party
-- "M"  was Minoritati   → rename to MIN (Minorităților Naționale)

-- Merge "P" deputies into PSD
UPDATE politicians
SET party_id = (SELECT id FROM parties WHERE abbreviation = 'PSD')
WHERE party_id = (SELECT id FROM parties WHERE abbreviation = 'P' AND name = 'P');

-- Also fix any party history entries (table created in migration 010)
UPDATE politician_party_history
SET party_id = (SELECT id FROM parties WHERE abbreviation = 'PSD')
WHERE party_id = (SELECT id FROM parties WHERE abbreviation = 'P' AND name = 'P');

DELETE FROM parties WHERE abbreviation = 'P' AND name = 'P';

-- Merge "M" into existing MIN party
UPDATE politicians
SET party_id = (SELECT id FROM parties WHERE abbreviation = 'MIN')
WHERE party_id = (SELECT id FROM parties WHERE abbreviation = 'M' AND name = 'M');

UPDATE politician_party_history
SET party_id = (SELECT id FROM parties WHERE abbreviation = 'MIN')
WHERE party_id = (SELECT id FROM parties WHERE abbreviation = 'M' AND name = 'M');

DELETE FROM parties WHERE abbreviation = 'M' AND name = 'M';
