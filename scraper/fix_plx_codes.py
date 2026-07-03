"""
One-off repair: Camera vote subjects cite the Camera registry number (PL-x nr/an),
which the scraper used to store as a Senate-style "L{n}/{an}" code. PL-x and L are
independent registries, so Camera votes got attached to the wrong Senate laws:

  - class A: laws created BY the camera scraper (deputies votes only, fake L code).
      → recode to PLx{n}/{an}; null presidential/CCR data and em_url/summary
        (all were looked up on senat.ro by the wrong L code).
  - class B: camera votes merged into EXISTING Senate laws whose L number
        happened to match the PL-x number (the camera title also overwrote the
        Senate bill title).
      → move the deputies votes onto a new PLx law carrying the camera title,
        then restore the Senate title by re-fetching the Senate vote page.

Idempotent: PLx-coded laws are skipped; class B is detected by mixed chambers.

Usage:
  cd scraper
  .venv/bin/python fix_plx_codes.py [--dry-run]
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
from supabase import create_client

from senat_scraper import SenatScraper, _classify_law, _repair_mojibake

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("fix_plx")

L_CODE = re.compile(r"^L(\d+)/(\d{4})$")

PRESIDENTIAL_NULLS = {
    "presidential_status": None,
    "presidential_date": None,
    "ccr_decision": None,
    "ccr_date": None,
    "em_url": None,
    "summary": None,
    "summary_checked_at": None,
}


def load_env() -> tuple[str, str]:
    # root .env (same one the scrapers use)
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    if os.path.exists(env_path):
        for line in open(env_path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k, v)
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL / SUPABASE_KEY not set")
    return url, key


class SenatFetcher(SenatScraper):
    """Just the fetch+parse half of SenatScraper — no DB."""

    def __init__(self) -> None:  # noqa: super().__init__ needs DB creds
        self.delay_min, self.delay_max = 0.6, 1.2
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "VotRO/1.0 Romanian parliamentary vote tracker "
                "(research; contact: siminiucdenis@gmail.com)"
            ),
        })

    def senate_title(self, app_id: str) -> str | None:
        r = self._fetch(f"{self.DETAIL_URL}?AppID={app_id}")
        if not r:
            return None
        detail = self._parse_detail(app_id, r.text)
        title = (detail.law_title or "").strip() if detail else ""
        return _repair_mojibake(title) if title else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = load_env()
    db = create_client(url, key)

    laws = db.table("laws").select("id, code, title").execute().data or []
    votes = db.table("votes").select("id, law_id, chamber, senat_app_id").execute().data or []

    by_law: dict[str, list[dict]] = {}
    for v in votes:
        if v["law_id"]:
            by_law.setdefault(v["law_id"], []).append(v)

    fetcher = SenatFetcher()
    stats = {"class_a": 0, "class_b": 0, "titles_restored": 0, "skipped": 0}

    for law in laws:
        m = L_CODE.match(law["code"] or "")
        if not m:
            stats["skipped"] += 1
            continue
        lv = by_law.get(law["id"], [])
        chambers = {v["chamber"] for v in lv}
        plx_code = f"PLx{m.group(1)}/{m.group(2)}"

        if chambers == {"deputies"}:
            # ── class A: whole law belongs to the Camera registry ────────
            stats["class_a"] += 1
            log.info("A  %s → %s  (null presidential/em)", law["code"], plx_code)
            if not args.dry_run:
                db.table("laws").update({"code": plx_code, **PRESIDENTIAL_NULLS}).eq("id", law["id"]).execute()

        elif chambers == {"senate", "deputies"}:
            # ── class B: senate law polluted by a camera vote ────────────
            stats["class_b"] += 1
            dep_votes = [v for v in lv if v["chamber"] == "deputies"]
            log.info("B  %s: detach %d camera vote(s) → new %s", law["code"], len(dep_votes), plx_code)
            if not args.dry_run:
                new_law = {
                    "code": plx_code,
                    "title": law["title"],  # camera subject title belongs to the PL-x bill
                }
                cat = _classify_law(law["title"] or "")
                if cat:
                    new_law["law_category"] = cat
                res = db.table("laws").upsert(new_law, on_conflict="code").execute()
                new_id = res.data[0]["id"]
                for v in dep_votes:
                    db.table("votes").update({"law_id": new_id}).eq("id", v["id"]).execute()

            # restore the Senate bill title from its own vote page
            sen_vote = next((v for v in lv if v["chamber"] == "senate" and v["senat_app_id"]), None)
            if sen_vote:
                title = fetcher.senate_title(sen_vote["senat_app_id"])
                time.sleep(0.8)
                if title:
                    stats["titles_restored"] += 1
                    log.info("   title restored: %s", title[:90])
                    if not args.dry_run:
                        payload: dict = {"title": title}
                        cat = _classify_law(title)
                        if cat:
                            payload["law_category"] = cat
                        db.table("laws").update(payload).eq("id", law["id"]).execute()
                else:
                    log.warning("   could not recover senate title for %s", law["code"])

    log.info("done: %s%s", stats, " (dry run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
