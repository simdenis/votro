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
    dated: bool = False           # camera list: date in the from/until column
    group: Optional[str] = None   # camera list: parliamentary-group label


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


# National-minorities deputies have no constituency at all — cdep says
# "ales la nivel national" ("aleasa" for women) instead of a circumscripție line.
_NATIONAL = re.compile(r"alea?s\w*\s+la\s+nivel\s+nation", re.IGNORECASE)


def extract_county(html: str) -> Optional[str]:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    if _NATIONAL.search(_unaccent(text)):
        return "Minorități"
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


# Full table row: name link, circumscripție cell, group cell, from/until date
# cell. The date column is ambiguous (entered-late replacements AND early-ended
# mandates both show a date) — run_chamber resolves dated rows via the profile.
_CAMERA_ROW = re.compile(
    r'structura2015\.mp\?idm=(\d+)[^"]*"[^>]*>([^<]+)</a></b></td>\s*'
    r"<td[^>]*>.*?</td>\s*"
    r"<td>\s*<a[^>]*structura2015\.gp\?idg=\d+[^>]*>(.*?)</a>\s*</td>\s*"
    r"<td nowrap>([^<]*)</td>",
    re.DOTALL,
)


def camera_roster() -> list[Member]:
    html = fetch(CAMERA_LIST)
    seen: dict[str, Member] = {}
    for m in _CAMERA_ROW.finditer(html):
        idm, name = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
        group = re.sub(r"<br\s*/?>|\s+", " ", m.group(3)).strip() or None
        if idm not in seen and name and not name.isdigit():
            seen[idm] = Member(display=name, profile_url=CAMERA_PROFILE.format(idm=idm),
                               key=name_key(name), dated=bool(m.group(4).strip()), group=group)
    return list(seen.values())


_ENDED = re.compile(r"data încetării mandatului", re.IGNORECASE)


def mandate_ended(profile_html: str) -> bool:
    return bool(_ENDED.search(profile_html))


# Mandate start, for the presence denominator (migration 021).
# senat.ro: "validat în data de 21.12.2024"; cdep: "data validării: 21 decembrie 2024"
_RO_MONTHS = {"ianuarie": 1, "februarie": 2, "martie": 3, "aprilie": 4, "mai": 5, "iunie": 6,
              "iulie": 7, "august": 8, "septembrie": 9, "octombrie": 10, "noiembrie": 11, "decembrie": 12}
_VALIDATED_NUM = re.compile(r"validat[ăa]?\s+în\s+data\s+de\s+(\d{1,2})\.(\d{1,2})\.(\d{4})", re.IGNORECASE)
_VALIDATED_TXT = re.compile(r"data\s+validării:\s*(\d{1,2})\s+(\w+)\s+(\d{4})", re.IGNORECASE)


def extract_mandate_start(html: str) -> Optional[str]:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
    m = _VALIDATED_NUM.search(text)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    m = _VALIDATED_TXT.search(text)
    if m and _unaccent(m.group(2)).lower() in {_unaccent(k) for k in _RO_MONTHS}:
        month = _RO_MONTHS[next(k for k in _RO_MONTHS if _unaccent(k) == _unaccent(m.group(2)).lower())]
        return f"{m.group(3)}-{month:02d}-{int(m.group(1)):02d}"
    return None


# Group label (cdep list / senat profile) → our party abbreviation. Mirrors the
# vote-page mapping in camera_scraper/senat_scraper.
_GROUP_TO_ABBR = [
    ("social democrat", "PSD"), ("psd", "PSD"),
    ("national liberal", "PNL"), ("pnl", "PNL"),
    ("salvati romania", "USR"), ("usr", "USR"),
    ("aur", "AUR"),
    ("maghiare", "UDMR"), ("udmr", "UDMR"),
    ("minoritat", "MIN"),
    ("pace", "PACE"),
    ("sos", "SOSRO"),
    ("uniti pentru romania", "POT"), ("upr", "POT"), ("pot", "POT"),
    ("neafiliat", "IND"),
]


def group_to_abbr(label: Optional[str]) -> Optional[str]:
    if not label:
        return None
    key = _unaccent(label).lower()
    return next((abbr for frag, abbr in _GROUP_TO_ABBR if frag in key), None)


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
                .select("id, name, first_name, active, county, mandate_start")
                .eq("chamber", chamber)
                .range(start, start + 999)
                .execute()
                .data
            )
            rows += page
            if len(page) < 1000:
                return rows
            start += 1000

    def _party_id(self, abbr: Optional[str]) -> Optional[str]:
        if not abbr:
            return None
        if not hasattr(self, "_parties"):
            rows = self.db.table("parties").select("id, abbreviation").execute().data
            self._parties = {r["abbreviation"]: r["id"] for r in rows}
        return self._parties.get(abbr)

    def _insert_member(self, chamber: str, mem: Member) -> Optional[dict]:
        """Insert a roster member who never voted (ministers, mostly)."""
        parts = mem.display.split()
        if len(parts) < 2:
            log.warning("cannot split name %r — not inserting", mem.display)
            return None
        label = mem.group
        if chamber == "senate":
            # senat.ro displays "SURNAME First-Names"; group only on the profile
            caps = [t for t in parts if t == t.upper()]
            name = " ".join(caps) or parts[-1]
            first = " ".join(t for t in parts if t not in caps) or parts[0]
            if not label:
                try:
                    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", fetch(mem.profile_url)))
                    m = re.search(r"Grupul parlamentar:\s*(.{3,100})", text)
                    label = m.group(1) if m else None
                except requests.RequestException:
                    label = None
                time.sleep(_DELAY)
        else:
            name, first = parts[0], " ".join(parts[1:])
        abbr = group_to_abbr(label)
        payload = {"name": name, "first_name": first, "chamber": chamber,
                   "active": True, "party_id": self._party_id(abbr)}
        try:
            row = self.db.table("politicians").insert(payload).execute().data[0]
        except Exception as e:  # UNIQUE(name, first_name) collisions etc.
            log.warning("insert failed for %s: %s", mem.display, e)
            return None
        log.info("%s: inserted %s (%s) — holds a mandate, never voted", chamber, mem.display, abbr or "no party")
        row.setdefault("county", None)
        row["active"] = True
        return row

    def run_chamber(self, chamber: str) -> bool:
        roster = senate_roster() if chamber == "senate" else camera_roster()
        if len(roster) < MIN_ROSTER[chamber]:
            log.error("%s roster parse looks broken (%d members) — no changes made", chamber, len(roster))
            return False

        # The cdep list keeps ended mandates (with a date in the from/until
        # column) next to their replacements. Dated rows are ambiguous — only
        # the profile says "data încetării mandatului" — so resolve those few.
        current: list[Member] = []
        for mem in roster:
            if mem.dated:
                try:
                    if mandate_ended(fetch(mem.profile_url)):
                        log.info("%s: mandate ended — %s", chamber, mem.display)
                        time.sleep(_DELAY)
                        continue
                except requests.RequestException as e:
                    log.warning("profile fetch failed for %s (%s) — treating as current", mem.display, e)
                time.sleep(_DELAY)
            current.append(mem)
        roster = current
        log.info("%s roster: %d current members", chamber, len(roster))

        pols = self.politicians(chamber)
        by_key: dict[frozenset, list[dict]] = {}
        for p in pols:
            by_key.setdefault(name_key(p["name"], p["first_name"]), []).append(p)

        matched: dict[str, Member] = {}  # politician id -> roster member
        unmatched_roster: list[Member] = []
        for mem in roster:
            hits = by_key.get(mem.key, [])
            if len(hits) > 1:
                # Token sets collide for permuted names (Stoica Alin-Bogdan vs
                # Stoica Bogdan-Alin — two real deputies). Both sources put the
                # surname first, so exact order disambiguates.
                want = _unaccent(mem.display).lower().replace("-", " ")
                exact = [p for p in hits
                         if _unaccent(f"{p['name']} {p['first_name']}").lower().replace("-", " ") == want]
                hits = exact if len(exact) == 1 else hits
            if len(hits) == 1:
                matched[hits[0]["id"]] = mem
            elif len(hits) > 1:
                log.warning("ambiguous name %r matches %d rows — skipped", mem.display, len(hits))
            else:
                unmatched_roster.append(mem)

        log.info(
            "%s: %d matched, %d roster names with no DB row (never voted yet), %d DB rows to deactivate",
            chamber, len(matched), len(unmatched_roster), len(pols) - len(matched),
        )

        # Members who hold a mandate but never voted (ministers, mostly) have no
        # DB row — insert them so seat counts and county pages are complete.
        # Cap guards against a parse anomaly mass-inserting garbage.
        if len(unmatched_roster) > 10:
            log.error("%s: %d unmatched roster names — parse anomaly? skipping inserts", chamber, len(unmatched_roster))
        elif unmatched_roster and not self.dry_run:
            for mem in unmatched_roster:
                row = self._insert_member(chamber, mem)
                if row:
                    pols.append(row)
                    matched[row["id"]] = mem

        # Profile pass: county + mandate_start, only where missing (incremental).
        by_id = {p["id"]: p for p in pols}
        need_profile = [pid for pid in matched
                        if not by_id[pid]["county"] or not by_id[pid].get("mandate_start")]
        log.info("%s: fetching %d profiles (county/mandate_start)", chamber, len(need_profile))
        counties: dict[str, str] = {}
        starts: dict[str, str] = {}
        for pid in need_profile:
            mem = matched[pid]
            try:
                html = fetch(mem.profile_url)
            except requests.RequestException as e:
                log.warning("profile fetch failed for %s: %s", mem.display, e)
                time.sleep(_DELAY)
                continue
            if not by_id[pid]["county"]:
                county = extract_county(html)
                if county:
                    counties[pid] = county
                else:
                    log.warning("no county parsed for %s", mem.display)
            if not by_id[pid].get("mandate_start"):
                start = extract_mandate_start(html)
                if start:
                    starts[pid] = start
                else:
                    log.warning("no mandate_start parsed for %s", mem.display)
            time.sleep(_DELAY)

        if self.dry_run:
            log.info("DRY RUN — no writes")
            return True

        active_ids = set(matched)
        for p in pols:
            should_be_active = p["id"] in active_ids
            new_county = counties.get(p["id"])
            new_start = starts.get(p["id"])
            if p["active"] != should_be_active or new_county or new_start:
                update: dict = {"active": should_be_active}
                if new_county:
                    update["county"] = new_county
                if new_start:
                    update["mandate_start"] = new_start
                self.db.table("politicians").update(update).eq("id", p["id"]).execute()
        log.info("%s: updates applied (%d counties, %d mandate starts)", chamber, len(counties), len(starts))
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
