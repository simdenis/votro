-- 045: record which party a vote was cast WITH, on the vote row itself.
--
-- Today a vote belongs to whatever party its author belongs to *now*:
--
--     FROM parties p
--     LEFT JOIN politicians pol ON pol.party_id = p.id      -- current party
--     LEFT JOIN politician_votes pv ON pv.politician_id = pol.id
--
-- So when a member founds or joins a party, their entire voting record moves
-- with them. The new party inherits votes it never cast, the old one loses
-- votes it did cast, and cohesion for both is recomputed over a membership that
-- never existed. With Romanian parliamentary groups splitting as often as they
-- do (POT, SOS, PACE within one mandate) this is not an edge case.
--
-- The fix is to stop deriving the party and start recording it. Both chambers
-- print the parliamentary group next to each name on the vote page, and both
-- scrapers already resolve it to a party_id at the exact moment they write the
-- row (camera_scraper store_detail, senat_scraper store_detail) — the value was
-- simply thrown away. Store it.
--
-- Rollout is deliberately non-atomic. The column is nullable and the views read
-- COALESCE(pv.party_id, pol.party_id), so:
--   * new votes are correct from the next scrape onwards,
--   * old votes keep exactly today's behaviour until backfilled,
--   * the backfill can run in batches, at any pace, with no window where the
--     site shows wrong or missing numbers.

alter table politician_votes add column if not exists party_id uuid references parties(id);

comment on column politician_votes.party_id is
  'The parliamentary group this vote was cast with, as printed on the chamber''s '
  'own vote page. Immutable history: unlike politicians.party_id it does not '
  'follow the member when they switch. NULL for rows predating migration 045 '
  'that have not been backfilled yet — readers should COALESCE to the current '
  'party for those.';

create index if not exists politician_votes_party_id_idx
  on politician_votes (party_id) where party_id is not null;


-- ── Backfill ────────────────────────────────────────────────────────────────
-- 351k rows: too many for one statement inside the SQL editor's timeout. This
-- is bounded and re-runnable — execute it repeatedly until it reports 0 rows.
--
-- Source of truth is politician_party_history (the segment covering the vote
-- date); where no segment covers it, fall back to the member's current party,
-- which is what every reader does today anyway, so the fallback cannot make any
-- existing number worse.
--
--     update politician_votes pv
--     set party_id = coalesce(
--         (select h.party_id
--            from politician_party_history h
--            join votes v on v.id = pv.vote_id
--           where h.politician_id = pv.politician_id
--             and h.from_date <= v.vote_date
--             and (h.to_date is null or h.to_date >= v.vote_date)
--           order by h.from_date desc
--           limit 1),
--         (select pol.party_id from politicians pol where pol.id = pv.politician_id)
--     )
--     where pv.id in (
--         select id from politician_votes where party_id is null limit 50000
--     );
--
-- Progress:  select count(*) filter (where party_id is null) as remaining,
--                   count(*) as total from politician_votes;
