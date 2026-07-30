"""One-off repair: laws whose title is still the raw cdep vote subject.

camera_scraper's _clean_law_title only knew the two-segment boilerplate shape
("Vot final - X - Vot final adoptare PL n/an <title>"). cdep also emits a
one-segment form ("Vot final\\n- PH CD 100/2025 Adoptare PHCD 100/2025 <title>")
and a doubled one, so 81 laws were stored with "Vot final…" as their title and
show that way on the site, in search and in OG cards.

The prefix is deterministic and the real title sits right behind it, so this
re-runs the (now fixed) cleaner over what is already in the DB — no re-scrape.
A title that does not shrink is left alone.

Usage:
  cd scraper
  .venv/bin/python backfill_law_titles.py [--dry-run]
"""
from __future__ import annotations

import argparse
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from supabase import create_client

from camera_scraper import _clean_law_title, _classify_law
from paging import fetch_all

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("backfill_titles")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Re-clean law titles left as raw vote subjects")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and key):
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    db = create_client(url, key)

    laws = fetch_all(lambda: db.table("laws").select("id, code, title, law_category"))
    fixed = uncategorized = 0

    for law in laws:
        raw = law["title"] or ""
        cleaned = _clean_law_title(raw)
        if not cleaned or cleaned == raw.strip():
            continue
        fixed += 1
        log.info("%s: %r → %r", law["code"], raw[:60], cleaned[:60])
        if law["law_category"] is None:
            uncategorized += 1
        if not args.dry_run:
            payload: dict = {"title": cleaned}
            # The regex classifier only ever saw the boilerplate — give it the
            # real title. It stays silent on anything it cannot place, and
            # categorize_laws.py (Haiku) picks those up on its next run.
            if law["law_category"] is None and (cat := _classify_law(cleaned)):
                payload["law_category"] = cat
            db.table("laws").update(payload).eq("id", law["id"]).execute()

    log.info("done: %d title(s) repaired%s, %d of them had no category",
             fixed, " (dry run)" if args.dry_run else "", uncategorized)
    if fixed and not args.dry_run:
        log.info("run categorize_laws.py + interest_scorer.py to refresh anything still NULL")


if __name__ == "__main__":
    main()
