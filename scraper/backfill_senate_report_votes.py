"""One-off backfill: vote_type for Senate votes on committee reports.

Since 2026 senat.ro headings read "L262/2026 raport de respingere" instead of
"vot final (respingere)", and the scraper's regex missed it — ~170+ Senate
votes were stored with vote_type ''. On a rejection-report vote «Pentru» means
FOR REJECTING the bill, so the site printed "72 pentru · Respins" (L262/2026,
2026-06-02) and every senator who backed the rejection looked like a supporter.

Re-fetches each Senate vote with an empty vote_type, re-parses it with the
fixed scraper and stores the vote_type. Outcomes are left alone (the fișă rule
already set them); the script reports laws whose law_status senate_outcome
changes so they can be eyeballed.

Usage:
    python backfill_senate_report_votes.py [--dry-run] [--limit N]
"""
from __future__ import annotations

import argparse
import collections
import logging
import os
import sys

from dotenv import load_dotenv

from paging import fetch_all
from senat_scraper import SenatScraper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("backfill-senate-report")


def senate_outcomes(db, law_ids: list[str]) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for i in range(0, len(law_ids), 100):
        rows = db.table("law_status").select("law_id, senate_outcome") \
            .in_("law_id", law_ids[i:i + 100]).execute().data
        out.update({r["law_id"]: r["senate_outcome"] for r in rows})
    return out


def main() -> None:
    load_dotenv(override=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    s = SenatScraper(url, key, delay_min=0.7, delay_max=1.4)
    db = s.db

    rows = fetch_all(lambda: db.table("votes")
                     .select("id, law_id, senat_app_id, outcome, for_count, against_count")
                     .eq("chamber", "senate").not_.is_("senat_app_id", "null")
                     .or_("vote_type.is.null,vote_type.eq."), total=args.limit)
    log.info("%d Senate vote(s) with empty vote_type", len(rows))
    law_ids = sorted({r["law_id"] for r in rows if r["law_id"]})
    before = senate_outcomes(db, law_ids)

    found = collections.Counter()
    suspicious = []
    for i, r in enumerate(rows, 1):
        d = s.fetch_and_parse_detail(r["senat_app_id"])
        vt = (d.vote_type if d else "") or ""
        found[vt or "∅"] += 1
        if "respinger" in vt and r["outcome"] == "adoptat":
            suspicious.append(r)
        if vt and not args.dry_run:
            db.table("votes").update({"vote_type": vt}).eq("id", r["id"]).execute()
        if i % 50 == 0:
            log.info("%d/%d %s", i, len(rows), dict(found))

    log.info("vote_type found: %s", dict(found))
    for r in suspicious:
        log.warning("respingere vote stored as adoptat — check: %s %s–%s", r["id"], r["for_count"], r["against_count"])
    if not args.dry_run:
        after = senate_outcomes(db, law_ids)
        changed = [(l, before.get(l), after.get(l)) for l in law_ids if before.get(l) != after.get(l)]
        log.info("law_status senate_outcome changed for %d law(s)", len(changed))
        for l, b, a in changed:
            log.info("  %s: %s → %s", l, b, a)


if __name__ == "__main__":
    main()
