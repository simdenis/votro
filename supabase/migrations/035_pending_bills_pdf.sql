-- Migration 035: pending_bills gains the bill-text PDF (forma inițiatorului),
-- scraped from each bill's cdep fișa page, so the tacite list can link the
-- actual document next to the deadline.

alter table pending_bills add column if not exists pdf_url text;
