"""Mark active mandates + electoral county for both chambers.

The politicians table keeps everyone who ever voted this legislature, so seat
counts drift upward as members are replaced. This scraper reads the official
member lists and marks who currently holds a mandate:

    Senate: https://www.senat.ro/FisaSenatori.aspx          (+ FisaSenator.aspx profile)
    Camera: cdep.ro /ords/pls/parlam/structura2015.de       (+ structura2015.mp profile)

cdep.ro drops non-EU IPs — run on the EU VPS (part of run_daily.sh).

Matching is by normalized name tokens (unaccented, case/hyphen-insensitive,
order-independent), since we store no external member ids. A chamber is only
updated when the roster parse looks sane (enough members found), so a source
hiccup can never mass-deactivate a chamber.

Usage:
    python roster_scraper.py                # both chambers
    python roster_scraper.py --chamber senate|deputies
    python roster_scraper.py --dry-run      # report matches, write nothing
"""
from __future__ import annotations

import argparse
import logging
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("roster")

UA = {"User-Agent": "Mozilla/5.0 (compatible; VotRO/1.0; +https://vot-romania.vercel.app)"}
_TIMEOUT = 30
_DELAY = 0.6  # politeness between profile fetches

SENATE_LIST = "https://www.senat.ro/FisaSenatori.aspx"
SENATE_PROFILE = "https://www.senat.ro/FisaSenator.aspx?ParlamentarID={pid}"
CAMERA_LIST = "https://www.cdep.ro/ords/pls/parlam/structura2015.de?leg=2024&idl=1"
CAMERA_PROFILE = "https://www.cdep.ro/ords/pls/parlam/structura2015.mp?idm={idm}&cam=2&leg=2024"

# Sanity floors: never mass-deactivate a chamber on a broken parse.
MIN_ROSTER = {"senate": 100, "deputies": 250}

# Canonical county names — sources disagree on diacritics/case
# (senat.ro "Cluj", cdep.ro "SUCEAVA"), so both map through unaccented keys.
_COUNTIES = [
    "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani",
    "Brașov", "Brăila", "București", "Buzău", "Caraș-Severin", "Călărași",
    "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu",
    "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș",
    "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Satu Mare", "Sălaj",
    "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vaslui", "Vâlcea",
    "Vrancea", "Diaspora",
]


def _unaccent(s: str) -> str:
    # Pre-1993 orthography survives on senat.ro ("Dîmboviţa"): fold î into â
    # first so both spellings land on the same unaccented key.
    s = s.replace("î", "â").replace("Î", "Â")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


_COUNTY_BY_KEY = {_unaccent(c).lower().replace("-", " "): c for c in _COUNTIES}
_COUNTY_BY_KEY["strainatate"] = "Diaspora"  # cdep's label for the diaspora constituency


def canonical_county(raw: str) -> Optional[str]:
    key = re.sub(r"\s+", " ", _unaccent(raw).lower().replace("-", " ")).strip()
    return _COUNTY_BY_KEY.get(key)


def name_key(*parts: str) -> frozenset[str]:
    """Order/case/diacritic/hyphen-insensitive token set for a person's name."""
    tokens: list[str] = []
    for p in parts:
        p = _unaccent(p or "").lower()
        tokens += [t for t in re.split(r"[\s\-]+", p) if t]
    return frozenset(tokens)


@dataclass
class Member:
    display: str
    profile_url: str
    county: Optional[str] = None
    key: frozenset = field(default_factory=frozenset)


# ── Source parsing ────────────────────────────────────────────────────────────
def fetch(url: str, tries: int = 3) -> str:
    # senat.ro intermittently serves empty/near-empty pages; retry with backoff.
    last: Exception | None = None
    for attempt in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=_TIMEOUT)
            r.raise_for_status()
            if len(r.text) > 5000:
                return r.text
            last = RuntimeError(f"suspiciously small response ({len(r.text)}B)")
        except requests.RequestException as e:
            last = e
        time.sleep(2 * (attempt + 1))
    raise last if isinstance(last, requests.RequestException) else requests.RequestException(str(last))


# Sources disagree on everything after "nr.N" — senat.ro: "nr.13 Cluj în data
# de...", cdep.ro: "nr.8 BRAŞOV data validării..." (cedilla diacritics). So:
# take the words after the number and validate progressively against the
# canonical county list (whose keys are unaccented) instead of pattern-guessing.
_AFTER_NR = re.compile(r"circumscrip\w+\s+electoral\w+\s+nr\.?\s*(\d+)\s+(.{3,60})", re.IGNORECASE)


def extract_county(html: str) -> Optional[str]:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    for m in _AFTER_NR.finditer(text):
        # nr.43 is the diaspora constituency; both chambers label it with a
        # sentence ("...pentru românii cu domiciliul în afara țării"), not a
        # county name, so match it by number.
        if m.group(1) == "43":
            return "Diaspora"
        words = m.group(2).split()
        for n in (3, 2, 1):  # longest match first ("Satu Mare" before "Satu")
            county = canonical_county(" ".join(words[:n]))
            if county:
                return county
    return None


def senate_roster() -> list[Member]:
    html = fetch(SENATE_LIST)
    seen: dict[str, Member] = {}
    # NB: senat.ro uses single-quoted hrefs here
    for m in re.finditer(r'href=[\'"][^\'"]*FisaSenator\.aspx\?ParlamentarID=([0-9a-fA-F-]{36})[\'"][^>]*>([^<]+)<', html):
        pid, name = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
        if pid not in seen and name:
            seen[pid] = Member(display=name, profile_url=SENATE_PROFILE.format(pid=pid), key=name_key(name))
    return list(seen.values())


def camera_roster() -> list[Member]:
    html = fetch(CAMERA_LIST)
    seen: dict[str, Member] = {}
    for m in re.finditer(r'href="[^"]*structura2015\.mp\?idm=(\d+)[^"]*"[^>]*>([^<]+)<', html):
        idm, name = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
        if idm not in seen and name and not name.isdigit():
            seen[idm] = Member(display=name, profile_url=CAMERA_PROFILE.format(idm=idm), key=name_key(name))
    return list(seen.values())


# ── DB ───────────────────────────────────────────────────────────────────────
class Roster:
    def __init__(self, url: str, key: str, dry_run: bool = False) -> None:
        from supabase import create_client

        self.db = create_client(url, key)
        self.dry_run = dry_run

    def politicians(self, chamber: str) -> list[dict]:
        rows, start = [], 0
        while True:
            page = (
                self.db.table("politicians")
                .select("id, name, first_name, active, county")
                .eq("chamber", chamber)
                .range(start, start + 999)
                .execute()
                .data
            )
            rows += page
            if len(page) < 1000:
                return rows
            start += 1000

    def run_chamber(self, chamber: str) -> bool:
        roster = senate_roster() if chamber == "senate" else camera_roster()
        if len(roster) < MIN_ROSTER[chamber]:
            log.error("%s roster parse looks broken (%d members) — no changes made", chamber, len(roster))
            return False
        log.info("%s roster: %d current members", chamber, len(roster))

        pols = self.politicians(chamber)
        by_key: dict[frozenset, list[dict]] = {}
        for p in pols:
            by_key.setdefault(name_key(p["name"], p["first_name"]), []).append(p)

        matched: dict[str, Member] = {}  # politician id -> roster member
        unmatched_roster: list[str] = []
        for mem in roster:
            hits = by_key.get(mem.key, [])
            if len(hits) == 1:
                matched[hits[0]["id"]] = mem
            elif len(hits) > 1:
                log.warning("ambiguous name %r matches %d rows — skipped", mem.display, len(hits))
            else:
                unmatched_roster.append(mem.display)

        log.info(
            "%s: %d matched, %d roster names with no DB row (never voted yet), %d DB rows to deactivate",
            chamber, len(matched), len(unmatched_roster), len(pols) - len(matched),
        )
        if unmatched_roster:
            log.info("no DB row: %s", "; ".join(sorted(unmatched_roster)[:10]))

        # County: fetch profiles only where we don't have one yet (incremental).
        need_county = [pid for pid, mem in matched.items()
                       if not next(p for p in pols if p["id"] == pid)["county"]]
        log.info("%s: fetching %d profiles for county", chamber, len(need_county))
        counties: dict[str, str] = {}
        for pid in need_county:
            mem = matched[pid]
            try:
                county = extract_county(fetch(mem.profile_url))
            except requests.RequestException as e:
                log.warning("profile fetch failed for %s: %s", mem.display, e)
                county = None
            if county:
                counties[pid] = county
            else:
                log.warning("no county parsed for %s", mem.display)
            time.sleep(_DELAY)

        if self.dry_run:
            log.info("DRY RUN — no writes")
            return True

        active_ids = set(matched)
        for p in pols:
            should_be_active = p["id"] in active_ids
            new_county = counties.get(p["id"])
            if p["active"] != should_be_active or new_county:
                update: dict = {"active": should_be_active}
                if new_county:
                    update["county"] = new_county
                self.db.table("politicians").update(update).eq("id", p["id"]).execute()
        log.info("%s: updates applied (%d counties added)", chamber, len(counties))
        return True


def main() -> None:
    import os

    load_dotenv()
    ap = argparse.ArgumentParser(description="VotRO — active mandates + county roster scraper")
    ap.add_argument("--chamber", choices=["senate", "deputies"], help="only one chamber")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    r = Roster(url, key, dry_run=args.dry_run)
    ok = True
    for chamber in [args.chamber] if args.chamber else ["senate", "deputies"]:
        try:
            ok = r.run_chamber(chamber) and ok
        except requests.RequestException as e:
            log.error("%s roster fetch failed: %s", chamber, e)
            ok = False
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
