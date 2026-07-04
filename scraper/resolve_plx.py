"""
Resolve Camera-registry law codes (PLx{n}/{an}) to their Senate L codes and
merge the two halves of each bill.

The mapping comes from the cdep.ro project fisa, which is addressable by the
Camera registry number (upl_pck2015.proiect?nr={n}&an={an}&cam=2) and links
its "Nr. înregistrare — Senat" row to senat.ro/legis/lista.aspx?nr_cls=L{m},
i.e. the Senate code. (senat.ro's own search claims to accept PLX numbers but
returns zero results for them, so it can't be used for this.) The bill title
is then taken from the senat.ro page — authoritative + clean diacritics.

NOTE: cdep.ro drops non-EU IPs — run this from the EU VPS (like the scrapers).

For each resolved PLx law:
  - a Senate law with that L code exists in the DB → repoint the PLx law's
    votes to it and delete the PLx row
  - no such law → rename the PLx row to the L code and adopt the senat.ro
    title
Unresolved codes (no fisa, or no Senate number yet — e.g. Camera-first bills
that haven't reached the Senate) stay PLx.

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
SENAT_LINK = re.compile(r"lista\.aspx\?nr_cls=(L\d+)&(?:amp;)?an_cls=(\d{4})")
FISA_URL = "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect"
SENAT_LISTA_URL = "https://www.senat.ro/legis/lista.aspx"


class PlxResolver:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "VotRO/1.0 Romanian parliamentary vote tracker "
                "(research; contact: siminiucdenis@gmail.com)"
            ),
        })

    def resolve(self, plx_nr: str, plx_year: str) -> tuple[str, str] | None:
        """cdep fisa → (senate_code, senate_title) or None if no Senate number."""
        try:
            r = self.session.get(
                FISA_URL, params={"nr": plx_nr, "an": plx_year, "cam": "2"}, timeout=30
            )
            r.raise_for_status()
            r.encoding = "utf-8"
        except requests.RequestException as exc:
            log.warning("network error fetching fisa PLx%s/%s: %s", plx_nr, plx_year, exc)
            return None

        # cdep answers 200 even for unknown numbers — make sure this fisa is
        # about the requested project before trusting any link on it.
        if not re.search(rf"\b{plx_nr}/{plx_year}\b", r.text):
            log.warning("PLx%s/%s: no cdep fisa — leaving as PLx", plx_nr, plx_year)
            return None

        codes = {f"{m.group(1)}/{m.group(2)}" for m in SENAT_LINK.finditer(r.text)}
        if len(codes) != 1:
            log.warning(
                "PLx%s/%s: %d Senate link(s) on fisa %s — leaving as PLx",
                plx_nr, plx_year, len(codes), sorted(codes),
            )
            return None
        code = next(iter(codes))
        return code, self._senat_title(code)

    def _senat_title(self, code: str) -> str:
        """Bill title from the senat.ro page (first result row of the L lookup)."""
        nr_cls, an_cls = code.split("/")
        try:
            r = self.session.get(
                SENAT_LISTA_URL, params={"nr_cls": nr_cls, "an_cls": an_cls}, timeout=30
            )
            r.encoding = "utf-8"
        except requests.RequestException as exc:
            log.warning("%s: senat.ro title fetch failed: %s", code, exc)
            return ""
        soup = BeautifulSoup(r.text, "lxml")
        grid = soup.find(id="ctl00_B_Center_Lista_grdLista")
        b = grid.find("b") if grid else None
        title = b.get_text(" ", strip=True) if b else ""
        return _repair_mojibake(title)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = load_env()
    db = create_client(url, key)
    search = PlxResolver()

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
