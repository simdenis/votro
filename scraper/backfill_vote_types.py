"""One-off backfill: vote_type for existing Camera votes.

The scraper historically dropped the cdep "Subiect vot" line, so all Camera
votes have vote_type NULL and law_status can't tell a final vote from an
amendment vote on the same bill (L19/2026 showed "respins de Cameră" although
the final vote adopted it 205-2). Re-fetches each vote's detail page and
stores the classified subject ('vot final' / 'amendament' / …; '' when the
subject has no marker, so reruns skip it). Also re-cleans descriptions that
kept an amendment prefix.

cdep.ro drops non-EU IPs — run on the EU VPS.

Usage:
    python backfill_vote_types.py [--limit N] [--dry-run]
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from camera_scraper import classify_vote_subject, _clean_law_title

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("backfill-vote-types")

DETAIL_URL = "https://www.cdep.ro/ords/pls/steno/evot2015.nominal"
UA = {"User-Agent": "Mozilla/5.0 (compatible; VotRO/1.0; +https://vot-romania.vercel.app)"}


def vote_subject(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) >= 2 and cells[0].get_text(strip=True).lower().startswith("subiect"):
            return cells[1].get_text(" ", strip=True)
    return ""


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Backfill vote_type for Camera votes")
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    from supabase import create_client

    db = create_client(url, key)
    rows = (
        db.table("votes")
        .select("id, cdep_vote_id, description")
        .eq("chamber", "deputies")
        .not_.is_("cdep_vote_id", "null")
        .is_("vote_type", "null")
        .limit(args.limit)
        .execute()
        .data
    )
    log.info("%d Camera vote(s) without vote_type", len(rows))

    done = 0
    for row in rows:
        idv = row["cdep_vote_id"]
        try:
            r = requests.get(DETAIL_URL, params={"idv": str(idv), "idl": "1"},
                             headers=UA, timeout=30)
            r.raise_for_status()
        except requests.RequestException as e:
            log.warning("idv=%s: fetch failed: %s", idv, e)
            continue
        subject = vote_subject(r.text)
        vtype = classify_vote_subject(subject)
        patch: dict = {"vote_type": vtype}
        desc = row.get("description") or ""
        if vtype and vtype != "vot final":
            cleaned = _clean_law_title(subject)[:500]
            if cleaned and cleaned != desc:
                patch["description"] = cleaned
        log.info("idv=%s: %r → %r", idv, subject[:70], vtype)
        if not args.dry_run and vtype:
            try:
                db.table("votes").update(patch).eq("id", row["id"]).execute()
            except Exception as e:  # unique (law_id, date, type, chamber) dupes
                log.warning("idv=%s: update failed: %s", idv, e)
        done += 1
        time.sleep(0.5)

    log.info("done: %d updated%s", done, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
