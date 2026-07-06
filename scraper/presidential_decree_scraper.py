"""Fill presidential_status from presidency.ro decrees — the authoritative source.

senat.ro's legislative fisa often omits promulgation events, leaving laws stuck
without a presidential status even months after adoption. presidency.ro instead
publishes every signed decree and names the affected law by its **PL-x number**,
which we can resolve to our Senate L code via the cdep project fisa.

Pipeline:
  1. clear presidency.ro's JS proof-of-work challenge (presidency_client)
  2. list decree day-bundles per month via the /ajax/stiri/lista_ajax feed
     (categ=4 = "Decrete și acte oficiale")
  3. on each day page, parse "Decret ... promulgarea/reexaminarea Legii ...
     (PL-x N/YYYY)" entries + the signing date
  4. resolve PL-x -> Senate L code via the cdep fisa (needs the EU VPS)
  5. set laws.presidential_status (+ presidential_date) when it changed

Decree verbs → status:  promulgarea → promulgat ; reexaminarea → retrimis ;
sesizarea Curții Constituționale → sesizat_ccr.

cdep.ro drops non-EU IPs — the resolution step runs on the EU VPS (part of
run_daily.sh). Presidency parsing alone works anywhere (see --dry-run).

Usage:
    python presidential_decree_scraper.py [--years 2025,2026] [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime
import logging
import os
import re
import sys
import time
from dataclasses import dataclass

import requests
from dotenv import load_dotenv

from presidency_client import get_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("decrete")

FEED = "https://www.presidency.ro/ro/ajax/stiri/lista_ajax/?an={an}&luna={luna}&counter={c}&categ=4"
CDEP_FISA = "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect"
UA = {"User-Agent": "Mozilla/5.0"}

_VERB_STATUS = {
    "promulgarea": "promulgat",
    "reexaminarea": "retrimis",
}

# "Decret privind/pentru promulgarea Legii <title> (PL-x 66/2026)"
_DECREE_RE = re.compile(
    r"Decret\s+(?:privind|pentru)\s+(promulgarea|reexaminarea)\s+"
    r"Legii\s+(.*?)\s*\(\s*PL[-\s]?x?\s*(\d+)\s*/\s*(\d{4})\s*\)",
    re.IGNORECASE | re.DOTALL,
)
# CCR referral is phrased differently ("sesizarea Curții Constituționale")
_CCR_RE = re.compile(
    r"sesiz\w+\s+Cur[țt]ii\s+Constitu\w+.*?Legii\s+(.*?)\s*\(\s*PL[-\s]?x?\s*(\d+)\s*/\s*(\d{4})\s*\)",
    re.IGNORECASE | re.DOTALL,
)
_ROMANIAN_MONTHS = {
    "ianuarie": 1, "februarie": 2, "martie": 3, "aprilie": 4, "mai": 5, "iunie": 6,
    "iulie": 7, "august": 8, "septembrie": 9, "octombrie": 10, "noiembrie": 11, "decembrie": 12,
}


@dataclass
class Decree:
    plx_nr: str
    plx_year: str
    status: str          # promulgat | retrimis | sesizat_ccr
    date: datetime.date | None
    title: str


# ── presidency.ro ─────────────────────────────────────────────────────────────
def _day_bundles(session: requests.Session, an: int, luna: int) -> list[str]:
    """Return unique decree day-page URLs for one month (the signing date is
    read from each day page itself, so we don't need it here)."""
    seen: list[str] = []
    for c in range(1, 30):  # ~12 entries/page; generous cap for busy months
        r = session.get(FEED.format(an=an, luna=luna, c=c), timeout=25)
        if r.status_code != 200 or len(r.text) < 20:
            break
        urls = re.findall(r'href="(https://www\.presidency\.ro/ro/media/decrete[^"]+)"', r.text)
        fresh = [u for u in dict.fromkeys(urls) if u not in seen]
        if not fresh:  # page added nothing new → past the end of the list
            break
        seen += fresh
    return seen


def _parse_day(html: str) -> list[Decree]:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)

    # Anchor on the signing phrase ("a semnat vineri, 3 iulie 2026") — the page
    # holds many other dates (agenda, related news) that must not be picked.
    date = None
    if m := re.search(r"a\s+semnat\w*[^.]{0,40}?(\d{1,2})\s+([a-zăâîșţț]+)\s+(\d{4})", text, re.IGNORECASE):
        month = _ROMANIAN_MONTHS.get(m.group(2).lower())
        if month:
            date = datetime.date(int(m.group(3)), month, int(m.group(1)))

    out: list[Decree] = []
    for verb, title, nr, yr in _DECREE_RE.findall(text):
        out.append(Decree(nr, yr, _VERB_STATUS[verb.lower()], date, title.strip()[:200]))
    for title, nr, yr in _CCR_RE.findall(text):
        out.append(Decree(nr, yr, "sesizat_ccr", date, title.strip()[:200]))
    return out


def collect_decrees(session: requests.Session, years: list[int]) -> list[Decree]:
    today = datetime.date.today()
    decrees: list[Decree] = []
    for an in years:
        last_month = today.month if an == today.year else 12
        for luna in range(1, last_month + 1):
            bundles = _day_bundles(session, an, luna)
            for url in bundles:
                try:
                    html = session.get(url, timeout=25).text
                except requests.RequestException as e:
                    log.warning("day fetch failed %s: %s", url, e)
                    continue
                decrees += _parse_day(html)
                time.sleep(0.3)
            if bundles:
                log.info("%d-%02d: %d decree-days", an, luna, len(bundles))
    log.info("collected %d law decrees", len(decrees))
    return decrees


# ── cdep PL-x → Senate L code ─────────────────────────────────────────────────
def resolve_plx(nr: str, year: str) -> str | None:
    """PL-x nr/year → 'L<n>/<year>' via the cdep project fisa. Needs an EU IP."""
    try:
        r = requests.get(CDEP_FISA, params={"nr": nr, "an": year, "cam": "2", "idl": "1"},
                         timeout=40, headers=UA)
    except requests.RequestException as e:
        log.warning("cdep fisa fetch failed for PL-x %s/%s: %s", nr, year, e)
        return None
    t = re.sub(r"<[^>]+>", " ", r.text)
    t = re.sub(r"\s+", " ", t)
    # Senate code appears as "Senat: L559/2025" or "Senat: L337/29.09.2025"
    m = re.search(r"Senat:\s*L\s*(\d+)\s*/\s*(?:\d{1,2}\.\d{1,2}\.)?(\d{4})", t)
    return f"L{m.group(1)}/{m.group(2)}" if m else None


# ── DB ────────────────────────────────────────────────────────────────────────
class Store:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def law_by_code(self, code: str) -> dict | None:
        r = requests.get(f"{self.url}/rest/v1/laws",
                        params={"code": f"eq.{code}", "select": "id,code,presidential_status", "limit": "1"},
                        headers=self.h, timeout=30)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def set_status(self, law_id: str, status: str, date: datetime.date | None) -> None:
        payload = {"presidential_status": status}
        if date:
            payload["presidential_date"] = date.isoformat()
        r = requests.patch(f"{self.url}/rest/v1/laws", params={"id": f"eq.{law_id}"},
                          headers={**self.h, "Content-Type": "application/json"},
                          json=payload, timeout=30)
        r.raise_for_status()


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Fill presidential_status from presidency.ro decrees")
    ap.add_argument("--years", default="2025,2026", help="comma-separated years to scan")
    ap.add_argument("--dry-run", action="store_true", help="parse + resolve, but don't write")
    args = ap.parse_args()
    years = [int(y) for y in args.years.split(",")]

    session = get_session()
    session.headers.update({"X-Requested-With": "XMLHttpRequest"})
    decrees = collect_decrees(session, years)

    # De-dup by PL-x; a promulgation supersedes an earlier reexaminare/CCR.
    _rank = {"sesizat_ccr": 0, "retrimis": 1, "promulgat": 2}
    latest: dict[tuple[str, str], Decree] = {}
    for d in decrees:
        key = (d.plx_nr, d.plx_year)
        if key not in latest or _rank[d.status] >= _rank[latest[key].status]:
            latest[key] = d

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    store = Store(url, key)

    updated = matched = 0
    for (nr, yr), d in latest.items():
        code = resolve_plx(nr, yr)
        time.sleep(0.4)
        if not code:
            log.info("PL-x %s/%s unresolved (no Senate code on fisa) — %s", nr, yr, d.title[:50])
            continue
        law = store.law_by_code(code)
        if not law:
            continue
        matched += 1
        if law["presidential_status"] == d.status:
            continue
        log.info("%s ← PL-x %s/%s: %s (%s) [%s]", code, nr, yr, d.status, d.date, d.title[:45])
        if not args.dry_run:
            store.set_status(law["id"], d.status, d.date)
        updated += 1

    log.info("done: %d decrees, %d matched laws, %d %s",
             len(latest), matched, updated, "would update" if args.dry_run else "updated")


if __name__ == "__main__":
    main()
