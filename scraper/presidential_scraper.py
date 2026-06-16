"""
VotRO — Presidential & CCR status scraper
Targets: https://www.senat.ro/legis/lista.aspx?nr_cls={nr}&an_cls={year}

For each law in DB with status='complet' and presidential_status IS NULL
(or all laws with --all flag):
  1. Parse code: L125/2025 → nr_cls=L125, an_cls=2025
  2. Fetch senat.ro legislative journey page
  3. Scan stages rows for presidential/CCR actions (last action wins):
       "promulgat"                            → presidential_status='promulgat'
       "cere reexaminarea"                    → presidential_status='retrimis'
       "Președintele … sesizează … Curtea"   → presidential_status='sesizat_ccr'
       "Curtea … respinge"                    → ccr_decision='constitutional'
       "Curtea … admite în parte"             → ccr_decision='partial_neconstitutional'
       "Curtea … admite"                      → ccr_decision='neconstitutional'
  4. UPDATE laws table

Upsert key: law.id (UPDATE by primary key)
"""

from __future__ import annotations

import argparse
import datetime
import logging
import os
import random
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("votro.presidential")


# ──────────────────────────────────────────────────────────────
# Data class
# ──────────────────────────────────────────────────────────────
@dataclass
class PresidentialResult:
    presidential_status: Optional[str] = None   # promulgat | retrimis | sesizat_ccr
    presidential_date:   Optional[str] = None   # YYYY-MM-DD
    ccr_decision:        Optional[str] = None   # constitutional | neconstitutional | partial_neconstitutional
    ccr_date:            Optional[str] = None   # YYYY-MM-DD


# ──────────────────────────────────────────────────────────────
# Scraper
# ──────────────────────────────────────────────────────────────
class PresidentialScraper:
    BASE_URL  = "https://www.senat.ro"
    LEGIS_URL = "https://www.senat.ro/legis/lista.aspx"

    # Regex to split code like "L125/2025" or "L95/2026"
    CODE_RE = re.compile(r"^([A-Z]+\d+)/(\d{4})$", re.IGNORECASE)

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        delay_min: float = 1.0,
        delay_max: float = 2.0,
    ) -> None:
        self.delay_min = delay_min
        self.delay_max = delay_max

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "VotRO/1.0 Romanian parliamentary vote tracker "
                "(research; contact: siminiucdenis@gmail.com)"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        })

        self.db: Client = create_client(supabase_url, supabase_key)
        self._stats = {"updated": 0, "skipped": 0, "no_data": 0, "errors": 0}

    # ── helpers ────────────────────────────────────────────────

    def _delay(self) -> None:
        time.sleep(random.uniform(self.delay_min, self.delay_max))

    def _fetch(self, url: str, max_retries: int = 3) -> Optional[requests.Response]:
        for attempt in range(max_retries):
            try:
                r = self.session.get(url, timeout=30)
                if r.status_code in (404, 410):
                    log.debug("404/410 for %s", url)
                    return None
                r.raise_for_status()
                r.encoding = "utf-8"
                return r
            except requests.RequestException as exc:
                log.warning("Attempt %d failed for %s: %s", attempt + 1, url, exc)
                if attempt < max_retries - 1:
                    time.sleep(2 ** (attempt + 1))
        log.error("Gave up fetching %s", url)
        return None

    @staticmethod
    def _row_date_to_iso(date_str: str) -> Optional[str]:
        """Convert DD-MM-YYYY → YYYY-MM-DD."""
        m = re.match(r"(\d{2})-(\d{2})-(\d{4})", date_str.strip())
        if m:
            return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        return None

    # ── page parsing ───────────────────────────────────────────

    def _parse_page(self, html: str, law_code: str) -> Optional[PresidentialResult]:
        """
        Walk every table row on the senat.ro legislative journey page.
        Each relevant row has two cells: date (DD-MM-YYYY) and action text.
        We process rows in order, keeping the last match for each field.
        """
        soup = BeautifulSoup(html, "lxml")
        result = PresidentialResult()
        found_any = False

        for tr in soup.find_all("tr"):
            cells = tr.find_all("td")
            if len(cells) < 2:
                continue

            date_raw  = cells[0].get_text(strip=True)
            iso_date  = self._row_date_to_iso(date_raw)
            if not iso_date:
                continue

            action = cells[1].get_text(separator=" ", strip=True)
            lower  = action.lower()

            # ── CCR decisions (process before presidential so order matters) ──
            if "curtea constituțională" in lower or "curtea constitutionala" in lower:
                if "admite în parte" in lower or "admite in parte" in lower:
                    result.ccr_decision = "partial_neconstitutional"
                    result.ccr_date     = iso_date
                    found_any = True
                    log.debug("%s  CCR partial_neconstitutional on %s", law_code, iso_date)
                elif "admite" in lower:
                    result.ccr_decision = "neconstitutional"
                    result.ccr_date     = iso_date
                    found_any = True
                    log.debug("%s  CCR neconstitutional on %s", law_code, iso_date)
                elif "respinge" in lower:
                    result.ccr_decision = "constitutional"
                    result.ccr_date     = iso_date
                    found_any = True
                    log.debug("%s  CCR constitutional on %s", law_code, iso_date)

            # ── Presidential: CCR referral ─────────────────────────────────
            if ("președintele" in lower and
                ("sesizează" in lower or "sesizeaza" in lower) and
                ("curtea" in lower or "constituțional" in lower or "constitutional" in lower)):
                result.presidential_status = "sesizat_ccr"
                result.presidential_date   = iso_date
                found_any = True
                log.debug("%s  presidential sesizat_ccr on %s", law_code, iso_date)

            # ── Presidential: re-examination request ───────────────────────
            elif ("reexaminare" in lower or "reexaminarea" in lower or
                  "retrimite" in lower or
                  ("președintele" in lower and "cere" in lower)):
                result.presidential_status = "retrimis"
                result.presidential_date   = iso_date
                found_any = True
                log.debug("%s  presidential retrimis on %s", law_code, iso_date)

            # ── Presidential: promulgation ─────────────────────────────────
            elif "promulgat" in lower and ("decret" in lower or "lege" in lower):
                result.presidential_status = "promulgat"
                result.presidential_date   = iso_date
                found_any = True
                log.debug("%s  promulgat on %s", law_code, iso_date)

        if not found_any:
            return None
        return result

    # ── database operations ────────────────────────────────────

    def _pending_laws(self, all_laws: bool = False) -> list[dict]:
        """Return laws eligible for presidential status scraping."""
        # Get all complet law_ids from the view
        complet_res = (
            self.db.from_("law_status")
            .select("law_id, code")
            .eq("status", "complet")
            .execute()
        )
        complet = {r["law_id"]: r["code"] for r in (complet_res.data or [])}
        if not complet:
            return []

        if all_laws:
            return [{"law_id": k, "code": v} for k, v in complet.items()]

        # Filter those without presidential_status from the laws table
        ids = list(complet.keys())
        laws_res = (
            self.db.table("laws")
            .select("id")
            .in_("id", ids)
            .is_("presidential_status", "null")
            .execute()
        )
        pending_ids = {r["id"] for r in (laws_res.data or [])}
        return [
            {"law_id": k, "code": v}
            for k, v in complet.items()
            if k in pending_ids
        ]

    def _update_law(self, law_id: str, result: PresidentialResult) -> bool:
        payload: dict = {}
        if result.presidential_status:
            payload["presidential_status"] = result.presidential_status
            payload["presidential_date"]   = result.presidential_date
        if result.ccr_decision:
            payload["ccr_decision"] = result.ccr_decision
            payload["ccr_date"]     = result.ccr_date
        if not payload:
            return False
        try:
            self.db.table("laws").update(payload).eq("id", law_id).execute()
            return True
        except Exception as exc:
            log.error("DB update failed for law_id=%s: %s", law_id, exc)
            return False

    # ── public interface ───────────────────────────────────────

    def scrape_law(self, law_id: str, code: str) -> Optional[PresidentialResult]:
        """Fetch and parse one law. Returns result or None on failure/no data."""
        m = self.CODE_RE.match(code.strip())
        if not m:
            log.warning("Unrecognised code format: %s — skipping", code)
            self._stats["skipped"] += 1
            return None

        nr_cls, an_cls = m.group(1), m.group(2)
        url = f"{self.LEGIS_URL}?nr_cls={nr_cls}&an_cls={an_cls}"
        log.info("Fetching %s (%s)", code, url)

        self._delay()
        resp = self._fetch(url)
        if not resp:
            self._stats["errors"] += 1
            return None

        result = self._parse_page(resp.text, code)
        if not result:
            log.info("%s — no presidential/CCR data found yet", code)
            self._stats["no_data"] += 1
            return None

        log.info(
            "%s → presidential=%s (%s)  ccr=%s (%s)",
            code,
            result.presidential_status,
            result.presidential_date,
            result.ccr_decision,
            result.ccr_date,
        )
        return result

    def run(self, all_laws: bool = False, dry_run: bool = False) -> None:
        laws = self._pending_laws(all_laws)
        log.info("Found %d laws to process", len(laws))

        for law in laws:
            law_id = law["law_id"]
            code   = law["code"]

            result = self.scrape_law(law_id, code)
            if not result:
                continue

            if dry_run:
                log.info("[dry-run] would update %s with %s", code, result)
                self._stats["updated"] += 1
                continue

            if self._update_law(law_id, result):
                self._stats["updated"] += 1
            else:
                self._stats["errors"] += 1

        self.print_summary()

    def print_summary(self) -> None:
        s = self._stats
        log.info(
            "Done — updated: %d  no_data: %d  skipped: %d  errors: %d",
            s["updated"], s["no_data"], s["skipped"], s["errors"],
        )


# ──────────────────────────────────────────────────────────────
# CLI entry point
# ──────────────────────────────────────────────────────────────
def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="VotRO — presidential & CCR status scraper"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Re-check all complet laws, not just those with null presidential_status",
    )
    parser.add_argument(
        "--code",
        metavar="CODE",
        help="Scrape a single law by code (e.g. L125/2025) — prints result, does not write to DB",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log results without writing to DB",
    )
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env or environment.")
        sys.exit(1)

    delay_min = float(os.environ.get("SCRAPER_DELAY_MIN", "1.0"))
    delay_max = float(os.environ.get("SCRAPER_DELAY_MAX", "2.0"))

    scraper = PresidentialScraper(url, key, delay_min=delay_min, delay_max=delay_max)

    if args.code:
        result = scraper.scrape_law("test", args.code)
        if result:
            print(f"presidential_status : {result.presidential_status}")
            print(f"presidential_date   : {result.presidential_date}")
            print(f"ccr_decision        : {result.ccr_decision}")
            print(f"ccr_date            : {result.ccr_date}")
        else:
            print("No presidential/CCR data found for this law.")
        return

    scraper.run(all_laws=args.all, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
