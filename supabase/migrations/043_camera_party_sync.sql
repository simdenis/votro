-- 043: sync two deputies' party_id to their official cdep parliamentary group.
--
-- Background. Same class of bug as 042 (PACE senators), other chamber. The
-- Camera vote scraper writes politicians.party_id inside _upsert_politician,
-- which returns early on a _pol_id_cache hit — so party_id reflects the group
-- label from the first vote that mentioned the member in the last run that saw
-- them. A member who switches groups and then does not vote keeps the old label
-- indefinitely, because absentees never appear in a vote list at all.
--
-- Source of truth used here: the official cdep member list
-- (structura2015.de?leg=2024&idl=1), which carries a "Grup parlamentar" column.
-- roster_scraper already fetches and maps it (group_to_abbr) but only applies it
-- on INSERT of a never-voted member, never to correct an existing row.
--
-- NOT fixed from politician_party_history, deliberately. For Camera the history
-- is the weaker source: it is built from the same vote-page labels, and it
-- currently holds a single open segment "Ponta -> PSD from 2026-06-03" that cdep
-- contradicts (cdep still lists him under POT). Trusting the latest history
-- segment — the durable fix that was right for the Senate, where senat.ro's
-- roster carries no group at all — would have relabeled a former prime minister
-- to the wrong party on a press-facing page. Camera has a better source; use it.
--
-- Verified against cdep on 2026-07-28: 333 roster entries, 2 unambiguous
-- mismatches, both below. Reversible: set party_id back if a source proves
-- otherwise.

-- Andreea-Petronela Cîmpianu (Diaspora): SOSRO -> AUR
update politicians set party_id = 'b66c9356-986c-4139-9d26-bd57de49265d'
  where id = '695079bb-f0cd-4ffe-81ba-877c5050b9c3';

-- Ioana Grosaru (Minorități): MIN -> IND (cdep: "Neafiliaţi")
update politicians set party_id = '49e6bf5b-ae1f-4e95-8151-9c7ad0d66421'
  where id = 'ed94adea-b76c-4231-bc1f-9a0c1013f7f5';

-- Two known hazards left for the durable follow-up, both found while verifying
-- this migration:
--
-- 1) name_key() is a frozenset of name tokens, so members whose names are token
--    permutations collide: "Stoica Alin-Bogdan" (USR, București) and "Stoica
--    Bogdan-Alin" (MIN, Minorități) are two different deputies sharing one key.
--    Any roster-driven party sync must skip ambiguous keys rather than pick one,
--    or it will flip both to whichever the list happened to yield last.
-- 2) "Florin-Eugen Cîrligea" (AUR) does not match any cdep roster key, so his
--    label is currently unverifiable against the official list.
--
-- deputy_stats / party_absence / the switchers query are plain views, so the site
-- reflects this immediately. politician_monthly_absences (036) is NOT — it is
-- materialized and denormalizes party_abbr/party_color, so the monthly IG shame
-- card keeps serving the old labels until refresh_matviews.py runs.
