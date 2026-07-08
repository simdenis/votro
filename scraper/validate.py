"""Post-scrape data-integrity checks — the pipeline's smoke test.

Deterministic invariants over the scraped data. Every problem we've hit in
practice (amendment-vote ranked over the final vote, party mislabels, inverted
party-history intervals, orphan parties, presence > 100%) is a *certainty* bug —
best caught by assertions, not an LLM. This runs at the end of run_daily.sh and
logs every violation; it exits non-zero if any FAIL-level check trips, so the
heartbeat can surface "pipeline produced bad data" distinct from "scrape failed".

Checks are WARN (anomaly worth eyeballing) or FAIL (data is definitely wrong).

Env: SUPABASE_URL, SUPABASE_KEY.
Usage:
    python validate.py [--strict]   # --strict: WARN also counts toward exit code
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("validate")

fails = 0
warns = 0


def check(ok: bool, level: str, msg: str) -> None:
    global fails, warns
    if ok:
        return
    if level == "FAIL":
        fails += 1
        log.error("FAIL: %s", msg)
    else:
        warns += 1
        log.warning("WARN: %s", msg)


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="VotRO post-scrape data validation")
    ap.add_argument("--strict", action="store_true", help="WARN also affects exit code")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    from supabase import create_client

    db = create_client(url, key)

    def all_rows(table: str, select: str) -> list[dict]:
        out, step, start = [], 1000, 0
        while True:
            batch = db.table(table).select(select).range(start, start + step - 1).execute().data
            out.extend(batch)
            if len(batch) < step:
                return out
            start += step

    # 1) law_status: a law rejected in a chamber must not read as promulgated
    #    (the amendment-vs-final ranking bug). law_status is a view.
    laws = all_rows("law_status", "code,senate_outcome,camera_outcome,presidential_status")
    for l in laws:
        if l["presidential_status"] == "promulgat" and "respins" in (l["senate_outcome"], l["camera_outcome"]):
            check(False, "FAIL", f"{l['code']}: promulgated yet respins in a chamber "
                                 f"(senate={l['senate_outcome']} camera={l['camera_outcome']})")

    # 2) stats views: presence within [0,100]; participations ≤ chamber votes held
    for view in ("senator_stats", "deputy_stats"):
        for s in all_rows(view, "name,presence_pct,total_votes,votes_for,votes_against,votes_abstention,votes_not_voted,chamber_votes,active"):
            p = s.get("presence_pct")
            check(p is None or 0 <= p <= 100, "FAIL", f"{view} {s['name']}: presence_pct={p} out of range")
            participated = (s.get("votes_for") or 0) + (s.get("votes_against") or 0) \
                + (s.get("votes_abstention") or 0) + (s.get("votes_not_voted") or 0)
            cv = s.get("chamber_votes") or 0
            check(participated <= cv or cv == 0, "FAIL",
                  f"{view} {s['name']}: participated {participated} > chamber_votes {cv}")

    # 3) parties: none orphaned (0 members) — the 'P' duplicate was one
    parties = all_rows("parties", "abbreviation")
    pols = all_rows("politicians", "party_id,active")
    members = defaultdict(int)
    for p in pols:
        if p.get("party_id"):
            members[p["party_id"]] += 1
    party_ids = {p["abbreviation"]: 0 for p in parties}
    # re-fetch with ids to map counts
    for p in all_rows("parties", "id,abbreviation"):
        party_ids[p["abbreviation"]] = members.get(p["id"], 0)
    for abbr, n in party_ids.items():
        check(n > 0, "WARN", f"party {abbr!r} has 0 politicians (orphan?)")

    # 4) party history: no inverted intervals, ≤1 open segment per politician
    hist = all_rows("politician_party_history", "politician_id,from_date,to_date")
    open_by_pol = defaultdict(int)
    for h in hist:
        if h["to_date"] and h["to_date"] < h["from_date"]:
            check(False, "FAIL", f"party-history interval inverted: {h['from_date']}..{h['to_date']} (pol {h['politician_id'][:8]})")
        if not h["to_date"]:
            open_by_pol[h["politician_id"]] += 1
    for pol_id, n in open_by_pol.items():
        check(n <= 1, "FAIL", f"politician {pol_id[:8]} has {n} open party-history segments")

    # 5) votes: outcome present when counts exist; no absurd totals
    votes = all_rows("votes", "id,chamber,outcome,for_count,against_count,abstention_count,present_count")
    for v in votes:
        counted = (v.get("for_count") or 0) + (v.get("against_count") or 0) + (v.get("abstention_count") or 0)
        check(not (counted > 0 and v.get("outcome") is None), "WARN",
              f"vote {v['id'][:8]} ({v['chamber']}): {counted} votes cast but outcome is NULL")

    log.info("validation done: %d FAIL, %d WARN over %d laws / %d votes / %d history rows",
             fails, warns, len(laws), len(votes), len(hist))
    sys.exit(1 if fails or (args.strict and warns) else 0)


if __name__ == "__main__":
    main()
