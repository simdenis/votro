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
import datetime
import logging
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv

from paging import fetch_all

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

    def all_rows(table: str, select: str, order_by: str = "id") -> list[dict]:
        return fetch_all(lambda: db.table(table).select(select), order_by=order_by)

    # 1) law_status: a promulgated law must not have been rejected by the chamber
    #    whose vote decided it (the amendment-vs-final ranking bug). law_status is
    #    a view.
    #
    #    NOT "rejected by either chamber": under Romanian bicameralism a bill goes
    #    to the reflection chamber first and the decision chamber second, and the
    #    second vote is the one that carries. Senate rejects -> Chamber adopts ->
    #    promulgated is an ordinary, lawful path, and flagging it made this check
    #    fail on every run (L575/2025, L73/2026), which set rc=1 daily, lit the
    #    footer warning, and buried the failures that did matter.
    #
    #    Which chamber decides depends on the subject matter and we do not store
    #    it, so use the later vote as the decisive one — the decision chamber
    #    always votes second. With a date missing, fall back to the only
    #    unambiguous case: both chambers rejected.
    laws = all_rows("law_status", "code,senate_outcome,camera_outcome,presidential_status,"
                                  "senate_vote_date,camera_vote_date", "law_id")
    for l in laws:
        if l["presidential_status"] != "promulgat":
            continue
        senate_no = l["senate_outcome"] == "respins"
        camera_no = l["camera_outcome"] == "respins"
        if not (senate_no or camera_no):
            continue
        s_date, c_date = l.get("senate_vote_date"), l.get("camera_vote_date")
        if senate_no and camera_no:
            decisive_no, why = True, "both chambers rejected it"
        elif not (s_date and c_date):
            decisive_no, why = False, ""
        elif senate_no:
            decisive_no, why = s_date > c_date, f"the Senate decided last ({s_date}) and rejected"
        else:
            decisive_no, why = c_date > s_date, f"the Chamber decided last ({c_date}) and rejected"
        check(not decisive_no, "FAIL",
              f"{l['code']}: promulgated but {why} "
              f"(senate={l['senate_outcome']} camera={l['camera_outcome']})")

    # 1b) every vote must record the group it was cast with (045). party_vote_breakdown
    #     joins straight to it since 049, so a row without one silently disappears
    #     from every party breakdown and from the /analize matrix instead of being
    #     quietly wrong — make it loud.
    orphan = (
        db.table("politician_votes")
        .select("id", count="exact")
        .is_("party_id", "null")
        .limit(1)
        .execute()
        .count
    ) or 0
    check(orphan == 0, "FAIL",
          f"{orphan} politician_votes rows have no party_id — they are missing from "
          f"every party breakdown (see migration 049)")

    # 2) stats views: presence within [0,100]; participations ≤ chamber votes held
    for view in ("senator_stats", "deputy_stats"):
        for s in all_rows(view, "name,presence_pct,total_votes,votes_for,votes_against,"
                                "votes_abstention,votes_not_voted,chamber_votes,active",
                          "politician_id"):
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
    votes = all_rows("votes", "id,law_id,chamber,outcome,for_count,against_count,abstention_count,present_count")
    for v in votes:
        counted = (v.get("for_count") or 0) + (v.get("against_count") or 0) + (v.get("abstention_count") or 0)
        check(not (counted > 0 and v.get("outcome") is None), "WARN",
              f"vote {v['id'][:8]} ({v['chamber']}): {counted} votes cast but outcome is NULL")

    # 6) initiatives (057): clocks sane; a promulgated/adopted initiative whose
    #    code matches a law we hold votes for must carry the law link — without
    #    it the title never links to the vote record.
    today = datetime.date.today().isoformat()
    law_codes = {l["code"]: l["id"] for l in all_rows("laws", "id,code")}
    voted_law_ids = {v["law_id"] for v in votes if v.get("law_id")}
    inits = all_rows("initiatives", "cdep_code,senat_code,stage,stage_raw,registered_date,"
                                    "committee_since,stage_date,law_id")
    unmapped = 0
    for i in inits:
        code = i.get("senat_code") or i.get("cdep_code")
        if i.get("committee_since"):
            check(i["committee_since"] <= today, "FAIL",
                  f"initiative {code}: committee_since {i['committee_since']} is in the future")
        if i.get("registered_date"):
            check("2020-01-01" <= i["registered_date"] <= today, "FAIL",
                  f"initiative {code}: registered_date {i['registered_date']} out of range")
            if i.get("stage_date"):
                check(i["registered_date"] <= i["stage_date"], "WARN",
                      f"initiative {code}: stage_date {i['stage_date']} precedes registration {i['registered_date']}")
        if i.get("stage") in ("adoptat_final", "promulgat") and not i.get("law_id"):
            law_id = law_codes.get(i.get("senat_code") or "") or law_codes.get(i.get("cdep_code") or "")
            check(not (law_id and law_id in voted_law_ids), "FAIL",
                  f"initiative {code}: stage={i['stage']} but not linked to law {law_id} which has votes")
        if i.get("stage") is None and i.get("stage_raw"):
            unmapped += 1
    check(unmapped == 0, "WARN", f"{unmapped} initiatives have stage_raw the normalizer doesn't map")

    log.info("validation done: %d FAIL, %d WARN over %d laws / %d votes / %d history rows / %d initiatives",
             fails, warns, len(laws), len(votes), len(hist), len(inits))
    sys.exit(1 if fails or (args.strict and warns) else 0)


if __name__ == "__main__":
    main()
