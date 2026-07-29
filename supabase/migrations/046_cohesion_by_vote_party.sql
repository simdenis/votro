-- 046: attribute cohesion to the group a vote was cast with (needs 045).
--
-- Split out of 045 so the column lands even if this view fails: Supabase runs
-- a script as one transaction, so a single error rolls back the ALTER TABLE too.
-- ── Readers ─────────────────────────────────────────────────────────────────
-- party_cohesion, as redefined by 027 (contested votes only), but attributing
-- each vote to the group it was cast with. Column set is unchanged.
drop view if exists party_cohesion;

create view party_cohesion as
with contested as (
    select id
    from votes
    where for_count is not null and against_count is not null
      -- minority * 5 >= total  ⇔  minority >= 20% of votes cast
      and least(for_count, against_count + coalesce(abstention_count, 0)) * 5
          >= for_count + against_count + coalesce(abstention_count, 0)
),
-- count(a.vote_id) rather than count(a.*): vote_id is never null inside the
-- CTE, so the two are equivalent, and a whole-row reference to a CTE alias is
-- exactly the kind of construct worth not betting a migration on.
-- Attribute every contested vote to a party ONCE, before touching parties.
-- Joining parties to politicians first (the pre-045 shape) would restrict the
-- scan to a party's *current* members, so a vote cast under a previous group
-- could never be counted for it — the very bug this migration exists to fix.
attributed as (
    select
        coalesce(pv.party_id, pol.party_id) as eff_party_id,
        pv.vote_id,
        pv.vote_choice,
        pv.party_line_deviation
    from politician_votes pv
    join politicians pol on pol.id = pv.politician_id
    where pv.vote_id in (select id from contested)
)
select
    p.id                            as party_id,
    p.name,
    p.abbreviation,
    coalesce(p.color, '#9e9e9e')    as color,
    count(distinct a.vote_id)       as votes_participated,
    count(a.vote_id) filter (where a.vote_choice in ('for','against','abstention')) as total_active_votes,
    count(a.vote_id) filter (where a.party_line_deviation = false
                          and a.vote_choice in ('for','against','abstention')) as with_party_votes,
    count(a.vote_id) filter (where a.party_line_deviation = true) as deviation_count,
    round(
        count(a.vote_id) filter (where a.party_line_deviation = false
                              and a.vote_choice in ('for','against','abstention'))::numeric
        / nullif(count(a.vote_id) filter (where a.vote_choice in ('for','against','abstention')), 0)
        * 100, 1
    ) as cohesion_pct
from parties p
left join attributed a on a.eff_party_id = p.id
group by p.id, p.name, p.abbreviation, p.color;

-- Dropping the view drops its options with it: 002 and 027 both set this, and
-- losing it would silently make the view run with the definer's rights.
alter view public.party_cohesion set (security_invoker = true);
grant select on party_cohesion to anon;
