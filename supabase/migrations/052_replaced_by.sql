-- 052: who took the seat — cdep's "înlocuit de: <name>" on the ended profile.
-- Stored as the name text exactly as cdep states it (the frontend links it to
-- the successor's profile by name match). NULL when there is no successor —
-- national-minority seats (Ibram) are filled by the organisation, not a list.

ALTER TABLE politicians
  ADD COLUMN IF NOT EXISTS replaced_by text;
