-- 042: put the PACE senators in PACE (fix a frozen roster party).
--
-- Background. 12 senators left SOS România / POT and, from ~Sept 2025, vote as
-- the group "PACE – Întâi România". Their politician_party_history tracks this
-- correctly (latest segment = PACE), but politicians.party_id was stuck on the
-- OLD party (SOSRO/POT). Root cause: the Senate vote scraper sets party_id from
-- the FIRST vote it sees per run and caches it (_seen_politicians), so a party
-- change mid-mandate never propagates to party_id, while _update_party_history
-- keeps recording it. The Senate roster list carries no group label, so the
-- roster scraper can't correct it either.
--
-- Effect of the bug: PACE showed nowhere (0 members), these 12 appeared under
-- their old party, and none counted as "traseiști" (getSwitchers trusts party_id
-- as "now": first segment == current == SOSRO ⇒ "no net switch").
--
-- Fix: set each of the 12 to their LATEST history segment's party — the group
-- they actually vote with now. Not all are PACE: two moved further on
-- (Fodoca → IND, Peiu → PNL). Reversible: set party_id back if a source proves
-- otherwise. A durable scraper fix (sync party_id to the latest open history
-- segment) is a separate follow-up.

update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = 'a65c8ca4-9300-4c3e-9dd7-2a33bc71baca'; -- Ninel Peia: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = '1c444259-c012-48ce-82cd-e08d3aaedfa3'; -- Dorin-Silviu Petrea: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = '85cf273f-c215-4d2a-8e80-7c4637d47759'; -- Nadia-Cosmina Cerva: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = '654a87fa-9695-4bce-b23f-b272dc1320ed'; -- Olga Onea: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = 'd8ade6b7-b3bf-4b1c-986e-6fd127042e55'; -- Ștefan Borțun: POT → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = 'fbb8275f-26bd-4667-a183-9409d6746b72'; -- Ioan-Cristian Rusu: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = '17568ad1-3ba9-41a3-91e4-26912969f202'; -- Rodica Cușnir: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = 'd95e98b7-e2d1-461e-a242-f62c6547555b'; -- Cristian Bem: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = 'c7cc74ac-06a4-4476-8c3e-b5d5a3c5be9a'; -- Clement Sava: SOSRO → PACE
update politicians set party_id = '6e90f012-5e32-490c-b3b8-57150b2c0345' where id = 'cfe676f8-14b1-4045-b1da-8b350b44dfd5'; -- Daniel-Paul-Romeo Gheorghe: SOSRO → PACE
update politicians set party_id = '49e6bf5b-ae1f-4e95-8151-9c7ad0d66421' where id = 'a5ee1cd1-9397-4365-bc65-39a198902368'; -- Liviu-Iulian Fodoca: POT → IND
update politicians set party_id = '6ac74468-4bbc-4711-9fd8-f15d9f2b8389' where id = '37d69675-2cbc-4943-9062-4466053ea485'; -- Grigore-Adrian Peiu: SOSRO → PNL

-- All dependent views (senator_stats, party_cohesion, party_absence, the
-- switchers query) are plain views, so the site reflects this immediately —
-- nothing to refresh.
