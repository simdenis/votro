"""
VotRO — Camera Deputaților plenary vote scraper
Targets: https://www.cdep.ro/pls/steno/evot.lista?dat=YYYYMMDD&idl=1  (daily list)
         https://www.cdep.ro/pls/steno/evot.lista?idv={id}&idl=1       (vote detail)

Enumeration strategy:
  For each target date:
    1. GET evot.lista?dat=YYYYMMDD&idl=1 → page with vote rows
    2. Extract all idv integer IDs from href attributes (regex on raw HTML)
    3. GET evot.lista?idv={id}&idl=1 for each vote
    4. Parse: law code, title, date, totals, deputy votes by party

Upsert keys (idempotent):
  laws             → code
  parties          → abbreviation
  politicians      → (name, first_name)   [chamber='deputies']
  votes            → cdep_vote_id
  politician_votes → (politician_id, vote_id)
"""

from __future__ import annotations

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
from bs4 import BeautifulSoup, Tag
from dotenv import load_dotenv
from supabase import create_client, Client

# ──────────────────────────────────────────────────────────────
# Logging  (shares file with senat_scraper when both run)
# ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("votro.camera")


# ──────────────────────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────────────────────
@dataclass
class VoteTotals:
    present: int = 0
    for_: int = 0
    against: int = 0
    abstentions: int = 0
    not_voted: int = 0
    absent: int = 0


@dataclass
class PartyBreakdown:
    name: str = ""
    abbreviation: str = ""
    for_: int = 0
    against: int = 0
    abstentions: int = 0
    not_voted: int = 0


@dataclass
class DeputyVote:
    last_name: str = ""
    first_name: str = ""
    party_abbr: str = ""
    vote_choice: str = "absent"  # for | against | abstention | not_voted | absent


@dataclass
class VoteDetail:
    cdep_vote_id: int = 0
    law_code: str = ""
    law_title: str = ""
    vote_date: Optional[datetime.date] = None
    vote_type: str = ""
    outcome: Optional[str] = None  # 'adoptat' | 'respins' | None
    totals: VoteTotals = field(default_factory=VoteTotals)
    party_breakdown: list[PartyBreakdown] = field(default_factory=list)
    deputy_votes: list[DeputyVote] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────
# Vote-choice normaliser
# ──────────────────────────────────────────────────────────────
_CHOICE_MAP: dict[str, str] = {
    "pentru": "for",
    "da": "for",
    "împotrivă": "against",
    "impotriva": "against",
    "contra": "against",
    "nu": "against",
    "abținere": "abstention",
    "abtinere": "abstention",
    "abtinut": "abstention",
    "ab": "abstention",
    "s-a abținut": "abstention",
    "absent": "absent",
    "nu a votat": "not_voted",
    "nu au votat": "not_voted",
    "nevot": "not_voted",
    "-": "not_voted",
}


def _normalise_choice(raw: str) -> str:
    key = raw.lower().strip()
    return _CHOICE_MAP.get(key, "absent")


# ──────────────────────────────────────────────────────────────
# Party abbreviation helpers  (shared logic with senat_scraper)
# ──────────────────────────────────────────────────────────────
_PARTY_ABBREV_MAP: dict[str, str] = {
    "alianța pentru unitatea românilor": "AUR",
    "pace": "PACE",          # "PACE - Întâi România" — same party in both chambers (was split PACE/PIR)
    "pace - întâi românia": "PACE",
    "pace intai romania": "PACE",
    "oamenilor tineri": "POT",   # Partidul Oamenilor Tineri == grupul "Uniți pentru România" (was split POT/UPR)
    "uniți pentru românia": "POT",
    "uniti pentru romania": "POT",
    "uniți pentru": "POT",
    "upr": "POT",                # vote pages label the group with the short code "UPR"
    "pir": "PACE",               # likewise the senate "PACE - Întâi România" short code
    "s.o.s": "SOSRO",            # dotted spelling → without this the acronym logic emits "SR"
    "sos ro": "SOSRO",           # undotted spelling on some pages
    "sos romania": "SOSRO",
    "partidul national liberal": "PNL",
    "partidul social democrat": "PSD",
    "uniunea democrată maghiară din românia": "UDMR",
    "uniunea salvați românia": "USR",
    "pro românia": "PRO",
    "forța dreptei": "FD",
    "independenți": "IND",
    "neafiliați": "IND",
    "neafiliat": "IND",
    "neafiliati": "IND",
    "fara apartenenta": "IND",   # "Parlamentar fără apartenență la grupurile parlamentare"
    "fără apartenență": "IND",
    "minorităților naționale": "MIN",
    "minoritati": "MIN",
    "minorităti": "MIN",
}

# Canonical full names per abbreviation, so the parties table stores real names
# instead of the bare acronym. Used by _upsert_party.
_PARTY_FULL_NAME: dict[str, str] = {
    "PSD":   "Partidul Social Democrat",
    "PNL":   "Partidul Național Liberal",
    "USR":   "Uniunea Salvați România",
    "AUR":   "Alianța pentru Unirea Românilor",
    "UDMR":  "Uniunea Democrată Maghiară din România",
    "POT":   "Partidul Oamenilor Tineri",
    "SOSRO": "S.O.S. România",
    "PACE":  "PACE - Întâi România",
    "PRO":   "PRO România",
    "FD":    "Forța Dreptei",
    "PSDA":  "Afiliați PSD",
    "IND":   "Neafiliați",
    "MIN":   "Minoritățile naționale",
}

# Catch-all labels for members without a real party (unaffiliated, national
# minorities) — no party line exists, so no party_line_deviation is computed.
NO_LINE_PARTIES = {"IND", "MIN"}

# Members cdep lists under a group label that maps to the wrong party. Keyed by
# normalized "lastname|firstname" (see _norm). Applied in _upsert_politician so
# the correction survives every roster/vote scrape instead of reverting.
_PARTY_OVERRIDE: dict[str, str] = {
    "grosaru|ioana": "MIN",   # national-minorities deputy, shown as IND on cdep
}


def _norm(s: str) -> str:
    """Lowercase + strip all diacritics, so 'ţ' (cedilla) and 'ț' (comma) match."""
    import unicodedata
    return "".join(
        c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c)
    )


def _abbreviate(raw: str) -> str:
    if not raw:
        return ""
    # Strip qualifiers like "(afiliat)" before mapping
    cleaned = re.sub(r"\(afiliat[^\)]*\)", "", raw, flags=re.IGNORECASE).strip()
    norm = _norm(cleaned)
    for key, abbr in _PARTY_ABBREV_MAP.items():
        if _norm(key) in norm:
            return abbr
    stripped = re.sub(r"\s+", "", cleaned).upper()
    if len(stripped) <= 6 and re.match(r"^[A-ZĂÎȘȚÂ]+$", stripped):
        return stripped
    words = cleaned.split()
    acronym = "".join(w[0].upper() for w in words if w and re.match(r"^[A-ZĂÎȘȚÂ]", w))
    return acronym[:6] if acronym else cleaned[:6].upper()


def _split_name(full: str) -> tuple[str, str]:
    """
    Split 'IONESCU Ion Mihai' → ('IONESCU', 'Ion Mihai').
    Old cdep.ro format used ALL CAPS for family name; new format uses Title Case.
    Fallback: first word = family name, rest = given names.
    """
    parts = full.strip().split()
    if not parts:
        return "", ""
    last_parts: list[str] = []
    first_parts: list[str] = []
    switched = False
    for p in parts:
        if not switched and p.isupper():
            last_parts.append(p)
        else:
            switched = True
            first_parts.append(p)
    if last_parts:
        return " ".join(last_parts), " ".join(first_parts)
    # New Title Case format: first word is family name
    return parts[0], " ".join(parts[1:])


# ──────────────────────────────────────────────────────────────
# Law category classifier  (identical rules to senat_scraper)
# ──────────────────────────────────────────────────────────────
_CATEGORY_RULES: list[tuple[str, str]] = [
    ("Sănătate",       r"sănătat|medical|spital|farmaceut|sanitar|clinică|stomatolog|medicament|asigurări.*sănătate"),
    ("Educație",       r"educaț|învățăm|universit|student|didact|școlar|academic|cercetare"),
    ("Justiție",       r"penal|cod penal|recidiv|infracțiu|judecăt|procuror|avocat|execut.*silit|insolv|tribunal|contravențional"),
    ("Social",         r"social|familie|copil|femicid|violenț.*domestic|pensii|pensionar|muncă|salariu|șomaj|ajutor.*social|discriminar"),
    ("Infrastructură", r"autostrad|drum|feroviar|metrou|cale ferată|rutier|port |aeroport|pod |tunel|infrastructur"),
    ("Transport",      r"transport|trafic|circulaț|vehicul|auto"),
    ("Agricultură",    r"agricult|rural|produse agricole|silvic|fond funciar|pădure|defrișare|pescuit|acvacult"),
    ("Mediu",          r"mediu|ecolog|climă|deșeuri|reciclare|biodiversit|arii protejate|poluare|apă potabilă"),
    ("Energie",        r"energie|petrol|gaze|electricitate|nuclear|regenerab|cărbune|combustibil"),
    ("Apărare",        r"apărare|militar|armată|securitate națională|nato|armament|servicii secrete"),
    ("Economie",       r"fiscal|buget|impozit|taxe|tva|financiar|datorie publică|economie|comerț|investiț|capital|bursă"),
    ("Tehnologie",     r"digital|informatică|cibernetic|date personale|gdpr|inteligență artificială|software|cloud|internet"),
    ("Administrație",  r"administraț|funcționar public|primărie|consiliu local|descentralizar|servicii publice"),
]
_CATEGORY_PATTERNS = [
    (cat, re.compile(pat, re.IGNORECASE))
    for cat, pat in _CATEGORY_RULES
]


def _classify_law(title: str) -> Optional[str]:
    for cat, pat in _CATEGORY_PATTERNS:
        if pat.search(title):
            return cat
    return None


# cdep serves the vote object as a description prefixed with vote boilerplate, e.g.
#   "Vot final - PL-x 446/2026 - Vot final adoptare Adoptare PL 446/2026 <real title>"
#   "Vot final - PH CD 37/2026 - Vot final adoptare PHCD 37/2026 <real title>"
# Strip that prefix so only the actual law description remains.
_VOTE_TITLE_BOILERPLATE = re.compile(
    r"^\s*Vot final\s*-\s*.*?\s*-\s*Vot final\s+\w+\s+"
    r"(?:(?:Adoptare|Respingere|Adoptarea|Respingerea)\s+)?"
    r"(?:PL-?x?|PLCD|PHCD|PH\s*CD|PL)\s*[\d/]+\s+",
    re.IGNORECASE | re.DOTALL,
)


_AGENDA_BOILERPLATE = re.compile(
    r"^\s*Introducerea pe ordinea de zi a\s+(?:Pl-?x?\s*[\d/]+\s*)?(?:PL\s*[\d/]+\s*)?",
    re.IGNORECASE,
)

# Amendment / procedural subjects: "PL-x 180/2025 - Amendament respins 1 PL 180/2025 <title>"
_AMENDMENT_BOILERPLATE = re.compile(
    r"^\s*(?:PL-?x?|PH\s*CD|PHCD)\s*[\d/]+\s*-\s*"
    r"(?:Amendament(?:e)?\s+(?:admis|respins)e?\s*\d*|Retrimitere[^-]*|Prelungire[^-]*)\s*"
    r"(?:(?:Adoptare|Respingere)a?\s+)?"
    r"(?:(?:PL-?x?|PHCD|PH\s*CD|PL)\s*[\d/]+\s+)?",
    re.IGNORECASE | re.DOTALL,
)


def _clean_law_title(raw: str) -> str:
    """Remove the cdep 'Vot final …' / amendment / 'Introducerea pe ordinea de
    zi …' vote boilerplate that prefixes vote-derived titles. Leaves clean
    titles untouched."""
    t = _VOTE_TITLE_BOILERPLATE.sub("", raw)
    t = _AMENDMENT_BOILERPLATE.sub("", t)
    t = _AGENDA_BOILERPLATE.sub("", t)
    return t.strip()


def classify_vote_subject(subject: str) -> str:
    """Vote type from the cdep subject line: keeps law_status able to rank the
    final vote above amendment/procedural votes on the same bill. Amendment
    types keep their number ("amendament admis 3") — votes have a UNIQUE
    (law_id, vote_date, vote_type, chamber) constraint and one sitting can
    vote several amendments on the same bill."""
    s = subject.lower()
    if "vot final" in s:
        return "vot final"
    if m := re.search(r"amendamente?\s*(?:admis|respins)?e?\s*\d*", s):
        return re.sub(r"\s+", " ", m.group(0)).strip()
    if "retrimitere" in s:
        return "retrimitere la comisie"
    if "prelungire" in s or "ordinea de zi" in s:
        return "procedură"
    return ""


# cdep.ro's backend sometimes emits literal "?" where ș/ț (comma-below) should
# be — their legacy encoding can't represent them. A "?" immediately followed by
# a letter ("?i", "educa?iei") never occurs in a legitimate title, while a real
# question mark is always followed by space/punctuation/end.
_MOJIBAKE = re.compile(r"\?\w")


def _has_mojibake(title: str) -> bool:
    return bool(_MOJIBAKE.search(title))


def _repair_mojibake(title: str) -> str:
    """Fix only the unambiguous '?' patterns:
      - standalone word '?i' → 'și'; clitic '?i-' → 'ți-'
      - '?' before a consonant → 'ș' (Romanian never has ț+consonant: știre,
        școală, șpagă — while ț is always followed by a vowel)
    '?' before a vowel stays as-is: both ș and ț occur there (șa/ța, dețin/ieșire)
    and guessing is unsafe."""
    t = re.sub(r"(?<!\w)\?i\b(?!-)", "și", title)
    t = re.sub(r"(?<!\w)\?I\b(?!-)", "Și", t)
    t = re.sub(r"(?<!\w)\?i-", "ți-", t)
    t = re.sub(r"\?(?=[bcdfghjklmnpqrstvwxz])", "ș", t)
    t = re.sub(r"\?(?=[BCDFGHJKLMNPQRSTVWXZ])", "Ș", t)
    return t


# ──────────────────────────────────────────────────────────────
# Text helper
# ──────────────────────────────────────────────────────────────
def _txt(tag: Optional[Tag]) -> str:
    return tag.get_text(" ", strip=True) if tag else ""


# ──────────────────────────────────────────────────────────────
# Scraper
# ──────────────────────────────────────────────────────────────
class CameraScraper:
    BASE_URL   = "https://www.cdep.ro"
    LIST_URL   = "https://www.cdep.ro/ords/pls/steno/evot2015.data"
    DETAIL_URL = "https://www.cdep.ro/ords/pls/steno/evot2015.nominal"

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        delay_min: float = 1.5,
        delay_max: float = 3.0,
    ) -> None:
        self.delay_min = delay_min
        self.delay_max = delay_max

        self.session = requests.Session()
        self.session.verify = False
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
        self._stats = {"votes_scraped": 0, "votes_skipped": 0, "errors": 0}
        self._seen_politicians: set[str] = set()
        # In-memory ID caches — avoid re-resolving the same politician/party on
        # every vote (a day can have 40+ votes sharing the same ~280 deputies).
        self._pol_id_cache: dict[str, str] = {}
        self._party_id_cache: dict[str, str] = {}
        # politician_id → party_id of the open history entry; lazy-loaded
        self._open_history: dict[str, str] | None = None
        # PLx → (L code, senate title) resolution cache; None = unresolvable
        self._plx_cache: dict[str, Optional[tuple[str, str]]] = {}
        self._senat_search = None  # lazy resolve_plx.PlxResolver

    # ── network helpers ────────────────────────────────────────

    def _delay(self) -> None:
        time.sleep(random.uniform(self.delay_min, self.delay_max))

    def _fetch(self, url: str, params: Optional[dict] = None, max_retries: int = 3) -> Optional[requests.Response]:
        for attempt in range(max_retries):
            try:
                r = self.session.get(url, params=params, timeout=30)
                if r.status_code in (404, 410):
                    log.debug("404/410 for %s", r.url)
                    return None
                r.raise_for_status()
                r.encoding = "utf-8"
                return r
            except requests.RequestException as exc:
                log.warning("Request error on attempt %d for %s: %s", attempt + 1, url, exc)
            if attempt < max_retries - 1:
                time.sleep(2 ** (attempt + 1))
        log.error("Gave up fetching %s after %d attempts", url, max_retries)
        return None

    # ── list page: get idv IDs for a date ─────────────────────

    def get_idv_list(self, target: datetime.date) -> Optional[list[int]]:
        """Return all cdep_vote_id integers for votes on `target`, or None on network failure.
        Joint sessions (marked CD+SE on cdep.ro) are excluded — they mix senators and deputies."""
        dat_str = target.strftime("%Y%m%d")
        r = self._fetch(self.LIST_URL, params={"dat": dat_str, "idl": "1"})
        if not r:
            return None

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, "lxml")

        idvs: list[int] = []
        seen: set[int] = set()
        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            row_text = row.get_text(" ", strip=True)
            # cdep.ro marks joint Camera+Senat sessions as "CD+SE" in the row
            if "CD+SE" in row_text:
                m = re.search(r"\b(\d{5,6})\b", row_text)
                idv = int(m.group(1)) if m else "?"
                log.info("Date %s: skipping joint session (CD+SE) idv=%s", target, idv)
                continue
            # Extract idv from any link in this row
            for a in row.find_all("a", href=True):
                m = re.search(r"[?&]idv=(\d+)", a["href"])
                if m:
                    idv = int(m.group(1))
                    if idv not in seen:
                        seen.add(idv)
                        idvs.append(idv)

        log.info("Date %s: found %d vote(s) — idv=%s", target, len(idvs), idvs)
        return idvs

    # ── detail page: fetch + parse ─────────────────────────────

    def fetch_and_parse_detail(self, idv: int) -> Optional[VoteDetail]:
        url = self.DETAIL_URL
        log.info("Fetching vote detail: idv=%d", idv)
        r = self._fetch(url, params={"idv": str(idv), "idl": "1"})
        if not r:
            return None
        return self._parse_detail(idv, r.text)

    def _parse_detail(self, idv: int, html: str) -> Optional[VoteDetail]:  # noqa: C901
        soup = BeautifulSoup(html, "lxml")
        detail = VoteDetail(cdep_vote_id=idv)

        # ── 1. Find all page text in label→value table rows ───
        # cdep.ro uses <td> pairs: label | value.
        # We build a flat map of normalised label → value text.
        label_map: dict[str, str] = {}
        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True).lower().rstrip(":")
                value = cells[1].get_text(" ", strip=True)
                label_map[label] = value

        log.debug("idv=%d label_map keys: %s", idv, list(label_map.keys()))

        # Joint CD+SE sittings mix senators into the nominal list; the list-page
        # CD+SE guard missed two on 2026-04-29 (migration 020). The detail page
        # itself says "Sedinta: comuna a Camerei Deputatilor si Senatului" —
        # skip the whole vote before anything is upserted.
        sedinta = next(
            (v for k, v in label_map.items()
             if k.replace("ş", "s").replace("ș", "s").startswith("sedin")),
            "",
        )
        if "comun" in sedinta.lower():
            log.info("idv=%d: sedinta comuna (CD+SE) — skipping vote entirely", idv)
            return None

        # ── 2. Vote date ───────────────────────────────────────
        for key in ("data", "data votului", "dată"):
            raw_date = label_map.get(key, "")
            if raw_date:
                m = re.search(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})", raw_date)
                if m:
                    try:
                        detail.vote_date = datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                        break
                    except ValueError:
                        pass

        if not detail.vote_date:
            # Fallback: look for a date pattern anywhere in the page
            m = re.search(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})", html)
            if m:
                try:
                    detail.vote_date = datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                except ValueError:
                    pass

        if not detail.vote_date:
            log.warning("idv=%d: could not extract vote date", idv)

        # ── 3. Law code and title ──────────────────────────────
        # cdep.ro shows the object of the vote in an "Obiect" or "Proiect" cell.
        # Law codes follow patterns like: PL 123/2026, PLx123/2026, L 95/2026, etc.
        raw_subject = ""
        for key in ("subiect vot", "obiect", "proiect", "obiectul votului", "denumire"):
            raw_subject = label_map.get(key, "")
            if raw_subject:
                break

        if not raw_subject:
            # Try the page title or a prominent heading
            h = soup.find(["h3", "h4", "h2"])
            raw_subject = _txt(h) if h else ""

        if raw_subject:
            detail.vote_type = classify_vote_subject(raw_subject)
            detail.law_title = _clean_law_title(raw_subject)[:500]
            # Extract law code from subject text.
            # IMPORTANT: cdep cites the CAMERA registry number (PL-x nr/an),
            # which is independent from the Senate's L nr/an registry. Never
            # store a PL-x number as an L code — that attaches the vote to a
            # different (Senate) bill. PLx/PHCD live in their own namespace;
            # a resolver can later map PLx → the real Senate L code.
            if m := re.search(r"PL[-\s]?x?\s*(\d+)\s*/\s*(\d{4})", raw_subject, re.IGNORECASE):
                detail.law_code = f"PLx{m.group(1)}/{m.group(2)}"
            elif m := re.search(r"PH\s*CD\s*(\d+)\s*/\s*(\d{4})", raw_subject, re.IGNORECASE):
                detail.law_code = f"PHCD{m.group(1)}/{m.group(2)}"
            elif m := re.search(r"(?<![A-Za-z])L\s*(\d+)\s*/\s*(\d{4})", raw_subject):
                # genuine Senate reference (rare in cdep subjects)
                detail.law_code = f"L{m.group(1)}/{m.group(2)}"
            # NOTE: no bare "nnn/yyyy" fallback — it would catch references to
            # existing laws ("Legii nr.349/2002") and mislink the vote. A vote
            # without a recognizable code stays law-less ("vot de plen").

        if not detail.law_code:
            log.warning("idv=%d: could not extract law code from %r", idv, raw_subject[:80])

        # ── 4. Vote type & outcome ─────────────────────────────
        for key in ("tip vot", "tipul votului", "tip"):
            val = label_map.get(key, "")
            if val:
                detail.vote_type = val.lower()
                break

        for key in ("rezultat", "rezultatul votului"):
            val = label_map.get(key, "").lower()
            if val:
                if "adoptat" in val:
                    detail.outcome = "adoptat"
                elif "respins" in val or "neadoptat" in val:
                    detail.outcome = "respins"
                break

        # ── 5. Vote totals ─────────────────────────────────────
        def _int(s: str) -> int:
            m = re.search(r"\d+", s)
            return int(m.group()) if m else 0

        for key in ("- prezenti", "total voturi exprimate", "total votanți", "total", "total voturi"):
            if key in label_map:
                detail.totals.present = _int(label_map[key])
                break

        for key in ("- pentru (da)", "pentru", "voturi pentru"):
            if key in label_map:
                detail.totals.for_ = _int(label_map[key])
                break

        for key in ("- contra (nu)", "împotrivă", "impotriva", "contra", "voturi împotrivă"):
            if key in label_map:
                detail.totals.against = _int(label_map[key])
                break

        for key in ("- abtineri (ab)", "abțineri", "abtineri", "voturi abțineri"):
            if key in label_map:
                detail.totals.abstentions = _int(label_map[key])
                break

        for key in ("- nu au votat (-)", "nu au votat", "nu a votat", "nevotați"):
            if key in label_map:
                detail.totals.not_voted = _int(label_map[key])
                break

        for key in ("absenți", "absenti", "absent"):
            if key in label_map:
                detail.totals.absent = _int(label_map[key])
                break

        # ── 6. Individual deputy votes ─────────────────────────
        # cdep.ro detail pages have individual votes in one of two layouts:
        #
        # Layout A (grouped by party — most common):
        #   <div class="grup-parlamentar-list vot-list">
        #     <h4 class="grup-parlamentar-name">PSD</h4>
        #     <table>
        #       <tr><td><a href="...">IONESCU Ion</a></td><td>pentru</td></tr>
        #     </table>
        #   </div>
        #
        # Layout B (flat table with party column):
        #   <table>
        #     <tr><th>Deputat</th><th>Grup</th><th>Vot</th></tr>
        #     <tr><td>IONESCU Ion</td><td>PSD</td><td>pentru</td></tr>
        #   </table>
        #
        # We try Layout A first, then Layout B.

        # --- Layout A ---
        party_sections = soup.find_all("div", class_=re.compile(r"grup-parlamentar-list"))
        if party_sections:
            for section in party_sections:
                # Party name from heading
                heading = section.find(["h4", "h3", "h2", "strong"])
                party_raw = _txt(heading) if heading else ""
                party_abbr = _abbreviate(party_raw)

                for row in section.find_all("tr"):
                    cells = row.find_all("td")
                    if len(cells) < 2:
                        continue
                    name_raw = _txt(cells[0])
                    choice_raw = _txt(cells[-1])
                    if not name_raw or not choice_raw:
                        continue
                    last_name, first_name = _split_name(name_raw)
                    detail.deputy_votes.append(DeputyVote(
                        last_name=last_name,
                        first_name=first_name,
                        party_abbr=party_abbr,
                        vote_choice=_normalise_choice(choice_raw),
                    ))

                # Build party breakdown from grouped votes
                if detail.deputy_votes:
                    from collections import Counter
                    party_votes = [dv for dv in detail.deputy_votes if dv.party_abbr == party_abbr]
                    counts = Counter(dv.vote_choice for dv in party_votes)
                    detail.party_breakdown.append(PartyBreakdown(
                        name=party_raw,
                        abbreviation=party_abbr,
                        for_=counts.get("for", 0),
                        against=counts.get("against", 0),
                        abstentions=counts.get("abstention", 0),
                        not_voted=counts.get("not_voted", 0) + counts.get("absent", 0),
                    ))

        # --- Layout B fallback (flat table with Deputat / Grup / Vot headers) ---
        if not detail.deputy_votes:
            for table in soup.find_all("table"):
                headers = [_txt(th).lower() for th in table.find_all("th")]
                if not headers:
                    # Try first row as header
                    first_row = table.find("tr")
                    if first_row:
                        headers = [_txt(td).lower() for td in first_row.find_all("td")]

                # Need at least a name column and a vote column
                name_idx = next((i for i, h in enumerate(headers) if "deputat" in h or "nume" in h), None)
                party_idx = next((i for i, h in enumerate(headers) if "grup" in h or "part" in h), None)
                vote_idx = next((i for i, h in enumerate(headers) if "vot" in h), None)

                if name_idx is None or vote_idx is None:
                    continue

                rows = table.find_all("tr")[1:]  # skip header
                for row in rows:
                    cells = row.find_all("td")
                    if len(cells) <= max(name_idx, vote_idx):
                        continue
                    name_raw = _txt(cells[name_idx])
                    choice_raw = _txt(cells[vote_idx])
                    party_raw = _txt(cells[party_idx]) if party_idx is not None and party_idx < len(cells) else ""
                    if not name_raw or not choice_raw:
                        continue
                    last_name, first_name = _split_name(name_raw)
                    detail.deputy_votes.append(DeputyVote(
                        last_name=last_name,
                        first_name=first_name,
                        party_abbr=_abbreviate(party_raw),
                        vote_choice=_normalise_choice(choice_raw),
                    ))

                if detail.deputy_votes:
                    break  # found votes, stop searching tables

        if not detail.deputy_votes:
            log.warning("idv=%d: deputy vote list is empty — HTML structure may differ from expected", idv)

        log.info(
            "idv=%d parsed: law=%s date=%s deputies=%d",
            idv, detail.law_code or "?", detail.vote_date, len(detail.deputy_votes),
        )
        return detail

    # ── already-scraped check ──────────────────────────────────

    def already_scraped(self, idv: int) -> bool:
        res = self.db.table("votes").select("id").eq("cdep_vote_id", idv).execute()
        return bool(res.data)

    # ── DB helpers ─────────────────────────────────────────────

    def _upsert_party(self, abbreviation: str, name: str) -> Optional[str]:
        if not abbreviation:
            return None
        if abbreviation in self._party_id_cache:
            return self._party_id_cache[abbreviation]
        full_name = _PARTY_FULL_NAME.get(abbreviation, name or abbreviation)
        res = (
            self.db.table("parties")
            .upsert({"abbreviation": abbreviation, "name": full_name}, on_conflict="abbreviation")
            .execute()
        )
        pid = res.data[0]["id"] if res.data else None
        if not pid:
            res2 = self.db.table("parties").select("id").eq("abbreviation", abbreviation).execute()
            pid = res2.data[0]["id"] if res2.data else None
        if pid:
            self._party_id_cache[abbreviation] = pid
        return pid

    def _upsert_politician(self, last_name: str, first_name: str, party_id: Optional[str]) -> Optional[str]:
        if not last_name:
            return None
        key = f"{last_name}|{first_name}"
        if key in self._pol_id_cache:           # in-memory hit — no DB round-trip
            return self._pol_id_cache[key]

        # Force the correct party for known-misclassified members (overrides the
        # party the group-label mapping resolved). Upsert then corrects the row.
        override = _PARTY_OVERRIDE.get(f"{_norm(last_name)}|{_norm(first_name)}")
        if override:
            party_id = self._upsert_party(override, _PARTY_FULL_NAME.get(override, override)) or party_id

        payload: dict = {"name": last_name, "first_name": first_name, "chamber": "deputies"}
        if party_id:
            payload["party_id"] = party_id

        res = (
            self.db.table("politicians")
            .upsert(payload, on_conflict="name,first_name")
            .execute()
        )
        pid = res.data[0]["id"] if res.data else None
        if not pid:
            res2 = (
                self.db.table("politicians")
                .select("id")
                .eq("name", last_name)
                .eq("first_name", first_name)
                .execute()
            )
            pid = res2.data[0]["id"] if res2.data else None
        if pid:
            self._pol_id_cache[key] = pid
        return pid

    def _resolve_plx(self, code: str) -> Optional[tuple[str, str]]:
        """PLx{n}/{an} → (senate L code, senate title) via the cdep project
        fisa's Senate cross-reference. Cached per run; None when unresolved."""
        if code in self._plx_cache:
            return self._plx_cache[code]
        result = None
        m = re.match(r"^PLx(\d+)/(\d{4})$", code)
        if m:
            if self._senat_search is None:
                from resolve_plx import PlxResolver
                self._senat_search = PlxResolver()
            try:
                result = self._senat_search.resolve(m.group(1), m.group(2))
            except Exception as exc:  # resolution is best-effort
                log.warning("%s: PLx resolution failed: %s", code, exc)
        self._plx_cache[code] = result
        return result

    def _upsert_law(self, code: str, title: str) -> Optional[str]:
        if not code:
            return None
        if code.startswith("PLx"):
            resolved = self._resolve_plx(code)
            if resolved:
                l_code, l_title = resolved
                log.info("%s → %s (cdep fisa)", code, l_code)
                code = l_code
                title = l_title or title  # senate bill title is authoritative
        if title and _has_mojibake(title):
            title = _repair_mojibake(title)
        if title and _has_mojibake(title):
            # Source title is mangled ('?' instead of ș/ț). Never overwrite an
            # existing clean title with it.
            existing = self.db.table("laws").select("id, title").eq("code", code).execute()
            if existing.data:
                ex = existing.data[0]
                if ex.get("title") and not _has_mojibake(ex["title"]):
                    log.warning("%s: keeping existing clean title (incoming has '?' mojibake)", code)
                    return ex["id"]
            log.warning("%s: title has '?' mojibake from cdep source: %r", code, title[:80])
        if code.startswith("L"):
            # Senate-registry law: the Senate scraper's bill title is the
            # authoritative one — don't overwrite it with a cdep vote subject.
            existing = self.db.table("laws").select("id, title").eq("code", code).execute()
            if existing.data and (existing.data[0].get("title") or "").strip():
                return existing.data[0]["id"]
        payload: dict = {"code": code, "title": title}
        category = _classify_law(title)
        if category:
            payload["law_category"] = category
        res = self.db.table("laws").upsert(payload, on_conflict="code").execute()
        if res.data:
            return res.data[0]["id"]
        res2 = self.db.table("laws").select("id").eq("code", code).execute()
        return res2.data[0]["id"] if res2.data else None

    def _upsert_vote(self, law_id: Optional[str], detail: VoteDetail) -> Optional[str]:
        outcome = detail.outcome
        # Derive when the page had no explicit result. Any votes cast is enough —
        # a unanimous rejection (0 for / N against) must still resolve to respins.
        if not outcome and (detail.totals.for_ or detail.totals.against or detail.totals.abstentions):
            outcome = "adoptat" if detail.totals.for_ > detail.totals.against else "respins"

        description = detail.law_title[:500] or None
        if description and _has_mojibake(description):
            description = _repair_mojibake(description)

        payload: dict = {
            "cdep_vote_id": detail.cdep_vote_id,
            "description": description,
            "chamber": "deputies",
            "vote_date": detail.vote_date.isoformat() if detail.vote_date else None,
            "vote_type": detail.vote_type or None,
            "present_count": detail.totals.present or None,
            "for_count": detail.totals.for_ or None,
            "against_count": detail.totals.against or None,
            "abstention_count": detail.totals.abstentions or None,
            "not_voted_count": detail.totals.not_voted or None,
            "outcome": outcome,
        }
        if law_id:
            payload["law_id"] = law_id

        res = self.db.table("votes").upsert(payload, on_conflict="cdep_vote_id").execute()
        if res.data:
            return res.data[0]["id"]
        res2 = self.db.table("votes").select("id").eq("cdep_vote_id", detail.cdep_vote_id).execute()
        return res2.data[0]["id"] if res2.data else None

    def _sync_party_history(
        self, politician_id: str, party_id: str, vote_date: datetime.date
    ) -> None:
        """Keep politician_party_history current. One prefetch of the open
        entries per run; writes only on first sight or party change — the
        naive per-member query (senat_scraper's approach) would add two
        round-trips per deputy per vote."""
        if self._open_history is None:
            res = (
                self.db.table("politician_party_history")
                .select("politician_id, party_id")
                .is_("to_date", "null")
                .execute()
            )
            self._open_history = {r["politician_id"]: r["party_id"] for r in (res.data or [])}
        current = self._open_history.get(politician_id)
        if current == party_id:
            return
        if current is not None:
            self.db.table("politician_party_history").update(
                {"to_date": (vote_date - datetime.timedelta(days=1)).isoformat()}
            ).eq("politician_id", politician_id).is_("to_date", "null").execute()
        self.db.table("politician_party_history").insert(
            {"politician_id": politician_id, "party_id": party_id, "from_date": vote_date.isoformat()}
        ).execute()
        self._open_history[politician_id] = party_id

    def _compute_deviations(self, vote_id: str) -> None:
        """Mark politician_votes where deputy voted against party majority.
        IND/MIN are catch-all labels for unaffiliated singles — no party line."""
        pv_res = (
            self.db.table("politician_votes")
            .select("id, politician_id, vote_choice, politicians(party_id, parties(abbreviation))")
            .eq("vote_id", vote_id)
            .execute()
        )
        rows = pv_res.data or []

        from collections import Counter
        # Group by party → majority choice
        party_choices: dict[str, list[str]] = {}
        for row in rows:
            pol = row.get("politicians") or {}
            pid = pol.get("party_id")
            abbr = (pol.get("parties") or {}).get("abbreviation")
            if pid and abbr not in NO_LINE_PARTIES:
                party_choices.setdefault(pid, []).append(row["vote_choice"])

        majority: dict[str, str] = {}
        for pid, choices in party_choices.items():
            active = [c for c in choices if c in ("for", "against", "abstention")]
            if active:
                majority[pid] = Counter(active).most_common(1)[0][0]

        for row in rows:
            pid = (row.get("politicians") or {}).get("party_id")
            if not pid or pid not in majority:
                continue
            is_deviation = (
                row["vote_choice"] in ("for", "against", "abstention")
                and row["vote_choice"] != majority[pid]
            )
            self.db.table("politician_votes").update(
                {"party_line_deviation": is_deviation}
            ).eq("id", row["id"]).execute()

    def store_detail(self, detail: VoteDetail) -> bool:
        """Persist a VoteDetail to Supabase. Returns True on success."""
        try:
            law_id = self._upsert_law(detail.law_code, detail.law_title)

            vote_id = self._upsert_vote(law_id, detail)
            if not vote_id:
                log.error("Failed to upsert vote for idv=%d", detail.cdep_vote_id)
                return False

            # Joint sessions (Camera + Senat together) have >350 present.
            # Skip individual vote tracking to avoid senators being recorded as deputies.
            if detail.totals.present > 350:
                log.info("idv=%d: joint session detected (%d present) — skipping individual votes", detail.cdep_vote_id, detail.totals.present)
                return True

            party_id_map: dict[str, str] = {}
            for pb in detail.party_breakdown:
                pid = self._upsert_party(pb.abbreviation, pb.name)
                if pid:
                    party_id_map[pb.abbreviation] = pid

            # Party-line majority per party, computed in memory (no extra DB pass).
            # IND/MIN members are singles — no party line, never a deviation.
            from collections import Counter
            active = ("for", "against", "abstention")
            by_party: dict[str, list[str]] = {}
            for dv in detail.deputy_votes:
                if dv.vote_choice in active and dv.party_abbr not in NO_LINE_PARTIES:
                    by_party.setdefault(dv.party_abbr, []).append(dv.vote_choice)
            majority = {ab: Counter(c).most_common(1)[0][0] for ab, c in by_party.items() if c}

            # Resolve ids (cached) and batch all politician_votes into ONE upsert.
            rows: list[dict] = []
            for dv in detail.deputy_votes:
                party_id = party_id_map.get(dv.party_abbr)
                if not party_id and dv.party_abbr:
                    party_id = self._upsert_party(dv.party_abbr, dv.party_abbr)
                    if party_id:
                        party_id_map[dv.party_abbr] = party_id

                pol_id = self._upsert_politician(dv.last_name, dv.first_name, party_id)
                if not pol_id:
                    continue
                if party_id and detail.vote_date:
                    self._sync_party_history(pol_id, party_id, detail.vote_date)

                rows.append({
                    "politician_id": pol_id,
                    "vote_id": vote_id,
                    "vote_choice": dv.vote_choice,
                    "party_line_deviation": (
                        dv.vote_choice in active
                        and dv.party_abbr in majority
                        and dv.vote_choice != majority[dv.party_abbr]
                    ),
                })

            if rows:
                self.db.table("politician_votes").upsert(rows, on_conflict="politician_id,vote_id").execute()
            return True

        except Exception as exc:  # noqa: BLE001
            log.error("store_detail failed for idv=%d: %s", detail.cdep_vote_id, exc, exc_info=True)
            return False

    # ── public scrape methods ──────────────────────────────────

    def scrape_date(self, target: datetime.date) -> None:
        log.info("=== Scraping Camera date: %s ===", target)
        idvs = self.get_idv_list(target)
        if idvs is None:
            log.error("cdep.ro unreachable for %s — network failure", target)
            self._stats["errors"] += 1
            return
        if not idvs:
            log.info("No votes found for %s", target)
            return

        for idv in idvs:
            if self.already_scraped(idv):
                log.info("Already scraped idv=%d — skipping", idv)
                self._stats["votes_skipped"] += 1
                continue

            self._delay()
            detail = self.fetch_and_parse_detail(idv)
            if not detail:
                self._stats["errors"] += 1
                continue

            ok = self.store_detail(detail)
            if ok:
                self._stats["votes_scraped"] += 1
            else:
                self._stats["errors"] += 1

    def scrape_range(self, start: datetime.date, end: datetime.date) -> None:
        current = start
        while current <= end:
            try:
                self.scrape_date(current)
            except Exception as exc:  # noqa: BLE001
                log.error("Unhandled error on %s: %s", current, exc, exc_info=True)
                self._stats["errors"] += 1
            current += datetime.timedelta(days=1)
        self.print_summary()

    def print_summary(self) -> None:
        print("\n" + "=" * 50)
        print("VotRO camera — run summary")
        print("=" * 50)
        print(f"  Votes scraped   : {self._stats['votes_scraped']}")
        print(f"  Votes skipped   : {self._stats['votes_skipped']} (already in DB)")
        print(f"  Deputies seen   : {len(self._seen_politicians)}")
        print(f"  Errors          : {self._stats['errors']}")
        print("=" * 50)


# ──────────────────────────────────────────────────────────────
# CLI entry point
# ──────────────────────────────────────────────────────────────
def main() -> None:
    import argparse

    load_dotenv()

    parser = argparse.ArgumentParser(description="VotRO — Camera Deputaților vote scraper")
    parser.add_argument(
        "--start",
        default=(datetime.date.today() - datetime.timedelta(days=30)).isoformat(),
        help="Start date YYYY-MM-DD (default: 30 days ago)",
    )
    parser.add_argument(
        "--end",
        default=datetime.date.today().isoformat(),
        help="End date YYYY-MM-DD (default: today)",
    )
    parser.add_argument("--date", help="Scrape a single date YYYY-MM-DD")
    parser.add_argument("--idv", type=int, help="Re-scrape a single vote by its idv integer")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env or environment.")
        sys.exit(1)

    delay_min = float(os.environ.get("SCRAPER_DELAY_MIN", "1.5"))
    delay_max = float(os.environ.get("SCRAPER_DELAY_MAX", "3.0"))

    scraper = CameraScraper(url, key, delay_min=delay_min, delay_max=delay_max)

    if args.idv:
        detail = scraper.fetch_and_parse_detail(args.idv)
        if not detail:
            print(f"ERROR: could not fetch/parse idv={args.idv}")
            sys.exit(1)
        ok = scraper.store_detail(detail)
        scraper._stats["votes_scraped" if ok else "errors"] += 1
        scraper.print_summary()
    elif args.date:
        scraper.scrape_date(datetime.date.fromisoformat(args.date))
        scraper.print_summary()
        if scraper._stats["errors"] > 0:
            sys.exit(1)
    else:
        start = datetime.date.fromisoformat(args.start)
        end = datetime.date.fromisoformat(args.end)
        scraper.scrape_range(start, end)
        if scraper._stats["errors"] > 0:
            sys.exit(1)


if __name__ == "__main__":
    main()
