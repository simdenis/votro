"""
Resolve Camera-registry law codes (PLx{n}/{an}) to their Senate L codes and
merge the two halves of each bill.

senat.ro's legislative search accepts PLX numbers directly (txtNri hint:
'L sau B sau BP sau PLX...'), so the mapping comes straight from the source:
POST the search form with txtNri="PLX{n}/{an}" → the result row links to
lista.aspx?nr_cls=L{m}&an_cls={y}, i.e. the Senate code, plus the bill title.

For each resolved PLx law:
  - a Senate law with that L code exists in the DB → repoint the PLx law's
    votes to it and delete the PLx row
  - no such law → rename the PLx row to the L code and adopt the senat.ro
    title (authoritative + clean diacritics)
Unresolved codes (0 or >1 results — e.g. Camera-only hotărâri) stay PLx.

Usage:
  cd scraper
  .venv/bin/python resolve_plx.py [--dry-run]
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
from bs4 import BeautifulSoup
from supabase import create_client

from senat_scraper import _classify_law, _repair_mojibake
from fix_plx_codes import load_env

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("resolve_plx")
logging.getLogger("httpx").setLevel(logging.WARNING)

PLX_CODE = re.compile(r"^PLx(\d+)/(\d{4})$")
RESULT_LINK = re.compile(r"/legis/lista\.aspx\?nr_cls=(L\d+)&an_cls=(\d{4})")
SEARCH_URL = "https://www.senat.ro/legis/lista.aspx"


class SenatSearch:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "VotRO/1.0 Romanian parliamentary vote tracker "
                "(research; contact: siminiucdenis@gmail.com)"
            ),
        })

    def resolve(self, plx_nr: str, plx_year: str) -> tuple[str, str] | None:
        """PLX search → (senate_code, senate_title) or None if not exactly one hit."""
        try:
            r = self.session.get(SEARCH_URL, timeout=30)
            r.encoding = "utf-8"
            soup = BeautifulSoup(r.text, "lxml")
            data: dict[str, str] = {}
            for inp in soup.find_all("input"):
                n = inp.get("name")
                if n:
                    data[n] = inp.get("value", "")
            for sel in soup.find_all("select"):
                n = sel.get("name")
                if n:
                    data[n] = ""
            for cb in soup.find_all("input", {"type": "checkbox"}):
                data.pop(cb.get("name"), None)
            data["ctl00$B_Center$Lista$txtNri"] = f"PLX{plx_nr}/{plx_year}"
            data["__EVENTTARGET"] = "ctl00$B_Center$Lista$btnCauta2"
            data["__EVENTARGUMENT"] = ""

            r2 = self.session.post(SEARCH_URL, data=data, timeout=30)
            r2.encoding = "utf-8"
        except requests.RequestException as exc:
            log.warning("network error searching PLX%s/%s: %s", plx_nr, plx_year, exc)
            return None

        soup2 = BeautifulSoup(r2.text, "lxml")
        hits: dict[str, str] = {}  # senate code → title
        for a in soup2.find_all("a", href=True):
            m = RESULT_LINK.match(a["href"])
            if not m:
                continue
            code = f"{m.group(1)}/{m.group(2)}"
            if code in hits:
                continue
            # bill title lives in the same result row, after the code link
            row = a.find_parent("tr")
            title = ""
            if row:
                cells = [td.get_text(" ", strip=True) for td in row.find_all("td")]
                title = max(cells, key=len, default="") if cells else ""
                title = re.split(r"\s*Inițiatori\s*:", title)[0].strip()
            hits[code] = title

        if len(hits) != 1:
            log.warning("PLX%s/%s: %d result(s) %s — leaving as PLx", plx_nr, plx_year, len(hits), list(hits))
            return None
        code, title = next(iter(hits.items()))
        return code, _repair_mojibake(title)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = load_env()
    db = create_client(url, key)
    search = SenatSearch()

    laws = db.table("laws").select("id, code, title").like("code", "PLx%").execute().data or []
    log.info("%d PLx laws to resolve", len(laws))
    stats = {"merged": 0, "renamed": 0, "unresolved": 0}

    for law in laws:
        m = PLX_CODE.match(law["code"])
        if not m:
            continue
        resolved = search.resolve(m.group(1), m.group(2))
        time.sleep(0.8)
        if not resolved:
            stats["unresolved"] += 1
            continue
        l_code, l_title = resolved

        existing = db.table("laws").select("id, title").eq("code", l_code).execute().data
        if existing:
            # merge: repoint votes, drop the PLx row
            target = existing[0]
            stats["merged"] += 1
            log.info("MERGE  %s → %s (existing)", law["code"], l_code)
            if not args.dry_run:
                db.table("votes").update({"law_id": target["id"]}).eq("law_id", law["id"]).execute()
                db.table("laws").delete().eq("id", law["id"]).execute()
        else:
            stats["renamed"] += 1
            log.info("RENAME %s → %s | %s", law["code"], l_code, (l_title or law["title"] or "")[:70])
            if not args.dry_run:
                payload: dict = {"code": l_code}
                title = l_title or law["title"]
                if title:
                    payload["title"] = title
                    cat = _classify_law(title)
                    if cat:
                        payload["law_category"] = cat
                db.table("laws").update(payload).eq("id", law["id"]).execute()

    log.info("done: %s%s", stats, " (dry run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
