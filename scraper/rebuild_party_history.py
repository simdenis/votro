"""Rebuild politician_party_history into clean chronological segments.

The per-vote state machine in senat_scraper/camera_scraper assumes votes are
processed in date order. They aren't (daily runs scrape multiple dates, reruns
revisit old ones), so it closes-and-reopens the same party and writes rows whose
to_date precedes their from_date. Result on 2026-07-08: 516 rows, 36 with
inverted intervals, 12 politicians with same-party duplicate chains that look
like switches but aren't.

Fix, order-independent: each row's `from_date` is a real "seen in party X on
date D" observation. Discard the derived to_date, sort observations per
politician, collapse consecutive same-party runs into one segment, and set each
segment's to_date to the next segment's start − 1 day (last stays open). This is
idempotent — safe to run every day to absorb whatever transient duplicates the
live scrapers introduce between rebuilds.

Env: SUPABASE_URL, SUPABASE_KEY.
Usage:
    python rebuild_party_history.py [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime
import logging
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("party-history-rebuild")


def collapse(observations: list[tuple[str, str]]) -> list[dict]:
    """observations: (from_date_iso, party_id) — unordered, possibly duplicated.
    Returns clean segments [{party_id, from_date, to_date}] in date order."""
    seen: dict[str, str] = {}
    for d, pid in observations:
        # keep the earliest observation date per (date) — dedup identical rows
        if d not in seen:
            seen[d] = pid
    ordered = sorted(seen.items())  # by date
    segments: list[dict] = []
    for d, pid in ordered:
        if segments and segments[-1]["party_id"] == pid:
            continue  # same party continues — extend, don't split
        segments.append({"party_id": pid, "from_date": d, "to_date": None})
    for i in range(len(segments) - 1):
        nxt = datetime.date.fromisoformat(segments[i + 1]["from_date"])
        segments[i]["to_date"] = (nxt - datetime.timedelta(days=1)).isoformat()
    return segments


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Rebuild politician_party_history cleanly")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    from supabase import create_client

    db = create_client(url, key)
    rows = db.table("politician_party_history").select("*").execute().data or []
    by_pol: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for r in rows:
        by_pol[r["politician_id"]].append((r["from_date"], r["party_id"]))

    changed = switchers = 0
    for pid, obs in by_pol.items():
        clean = collapse(obs)
        distinct = len({s["party_id"] for s in clean})
        if distinct >= 2:
            switchers += 1
        # Compare to current stored rows (order + dates) — skip if already clean.
        current = sorted(
            ({"party_id": r["party_id"], "from_date": r["from_date"], "to_date": r["to_date"]}
             for r in rows if r["politician_id"] == pid),
            key=lambda x: x["from_date"],
        )
        if current == clean:
            continue
        changed += 1
        if args.dry_run:
            chain = " → ".join(s["party_id"][:4] for s in clean)
            log.info("would rebuild %s: %d rows → %d segments (%s)", pid, len(current), len(clean), chain)
            continue
        db.table("politician_party_history").delete().eq("politician_id", pid).execute()
        db.table("politician_party_history").insert(
            [{"politician_id": pid, **s} for s in clean]
        ).execute()

    log.info("done: %d politician(s) rebuilt, %d genuine switcher(s)%s",
             changed, switchers, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
