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
    "s-a abținut": "abstention",
    "absent": "absent",
    "nu a votat": "not_voted",
    "nu au votat": "not_voted",
    "nevot": "not_voted",
}


def _normalise_choice(raw: str) -> str:
    key = raw.lower().strip()
    return _CHOICE_MAP.get(key, "absent")


# ──────────────────────────────────────────────────────────────
# Party abbreviation helpers  (shared logic with senat_scraper)
# ──────────────────────────────────────────────────────────────
_PARTY_ABBREV_MAP: dict[str, str] = {
    "alianța pentru unitatea românilor": "AUR",
    "partidul românia în acțiune": "PIR",
    "partidul national liberal": "PNL",
    "partidul social democrat": "PSD",
    "uniunea democrată maghiară din românia": "UDMR",
    "uniunea salvați românia": "USR",
    "pro românia": "PRO",
    "forța dreptei": "FD",
    "independenți": "IND",
    "neafiliați": "IND",
    "neafiliat": "IND",
    "minorităților naționale": "MIN",
}


def _abbreviate(raw: str) -> str:
    if not raw:
        return ""
    lower = raw.lower().strip()
    for key, abbr in _PARTY_ABBREV_MAP.items():
        if key in lower:
            return abbr
    stripped = re.sub(r"\s+", "", raw).upper()
    if len(stripped) <= 6 and re.match(r"^[A-ZĂÎȘȚÂ]+$", stripped):
        return stripped
    words = raw.split()
    acronym = "".join(w[0].upper() for w in words if w and re.match(r"^[A-ZĂÎȘȚÂ]", w))
    return acronym[:6] if acronym else raw[:6].upper()


def _split_name(full: str) -> tuple[str, str]:
    """
    Split 'IONESCU Ion Mihai' → last_name='IONESCU', first_name='Ion Mihai'.
    cdep.ro names are typically FAMILY_NAME(s) Given_Name(s) with family in ALL CAPS.
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
    last_name = " ".join(last_parts) if last_parts else parts[0]
    first_name = " ".join(first_parts) if first_parts else ""
    return last_name, first_name


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
    LIST_URL   = "https://www.cdep.ro/pls/steno/evot.lista"

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

    def get_idv_list(self, target: datetime.date) -> list[int]:
        """Return all cdep_vote_id integers for votes on `target`."""
        dat_str = target.strftime("%Y%m%d")
        r = self._fetch(self.LIST_URL, params={"dat": dat_str, "idl": "1"})
        if not r:
            return []

        # cdep.ro links look like: /pls/steno/evot.lista?idv=12345&idl=1
        # We extract all idv values from the raw HTML (dedup, preserve order).
        found = re.findall(r"[?&]idv=(\d+)", r.text)
        idvs = list(dict.fromkeys(int(x) for x in found))
        log.info("Date %s: found %d vote(s) — idv=%s", target, len(idvs), idvs)
        return idvs

    # ── detail page: fetch + parse ─────────────────────────────

    def fetch_and_parse_detail(self, idv: int) -> Optional[VoteDetail]:
        url = self.LIST_URL
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
        for key in ("obiect", "proiect", "obiectul votului", "denumire"):
            raw_subject = label_map.get(key, "")
            if raw_subject:
                break

        if not raw_subject:
            # Try the page title or a prominent heading
            h = soup.find(["h3", "h4", "h2"])
            raw_subject = _txt(h) if h else ""

        if raw_subject:
            detail.law_title = raw_subject[:500]
            # Extract law code from subject text
            m = re.search(
                r"(?:PL[x\s]?|L|lege\s+nr\.?\s*)(\d+)\s*/\s*(\d{4})",
                raw_subject,
                re.IGNORECASE,
            )
            if m:
                detail.law_code = f"L{m.group(1)}/{m.group(2)}"
            else:
                # Broader fallback: any Nnn/YYYY pattern
                m2 = re.search(r"\b(\d{1,4})\s*/\s*(20\d{2})\b", raw_subject)
                if m2:
                    detail.law_code = f"L{m2.group(1)}/{m2.group(2)}"

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

        for key in ("total voturi exprimate", "total votanți", "total", "total voturi"):
            if key in label_map:
                detail.totals.present = _int(label_map[key])
                break

        for key in ("pentru", "voturi pentru"):
            if key in label_map:
                detail.totals.for_ = _int(label_map[key])
                break

        for key in ("împotrivă", "impotriva", "contra", "voturi împotrivă"):
            if key in label_map:
                detail.totals.against = _int(label_map[key])
                break

        for key in ("abțineri", "abtineri", "voturi abțineri"):
            if key in label_map:
                detail.totals.abstentions = _int(label_map[key])
                break

        for key in ("nu au votat", "nu a votat", "nevotați"):
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
        res = (
            self.db.table("parties")
            .upsert({"abbreviation": abbreviation, "name": name or abbreviation}, on_conflict="abbreviation")
            .execute()
        )
        if res.data:
            return res.data[0]["id"]
        res2 = self.db.table("parties").select("id").eq("abbreviation", abbreviation).execute()
        return res2.data[0]["id"] if res2.data else None

    def _upsert_politician(self, last_name: str, first_name: str, party_id: Optional[str]) -> Optional[str]:
        if not last_name:
            return None
        key = f"{last_name}|{first_name}"
        if key in self._seen_politicians:
            res = (
                self.db.table("politicians")
                .select("id")
                .eq("name", last_name)
                .eq("first_name", first_name)
                .execute()
            )
            return res.data[0]["id"] if res.data else None

        payload: dict = {"name": last_name, "first_name": first_name, "chamber": "deputies"}
        if party_id:
            payload["party_id"] = party_id

        res = (
            self.db.table("politicians")
            .upsert(payload, on_conflict="name,first_name")
            .execute()
        )
        if res.data:
            self._seen_politicians.add(key)
            return res.data[0]["id"]

        res2 = (
            self.db.table("politicians")
            .select("id")
            .eq("name", last_name)
            .eq("first_name", first_name)
            .execute()
        )
        if res2.data:
            self._seen_politicians.add(key)
            return res2.data[0]["id"]
        return None

    def _upsert_law(self, code: str, title: str) -> Optional[str]:
        if not code:
            return None
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
        if not outcome and detail.totals.for_ > 0 and detail.totals.against >= 0:
            outcome = "adoptat" if detail.totals.for_ > detail.totals.against else "respins"

        payload: dict = {
            "cdep_vote_id": detail.cdep_vote_id,
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

    def _compute_deviations(self, vote_id: str) -> None:
        """Mark politician_votes where deputy voted against party majority."""
        pv_res = (
            self.db.table("politician_votes")
            .select("id, politician_id, vote_choice, politicians(party_id)")
            .eq("vote_id", vote_id)
            .execute()
        )
        rows = pv_res.data or []

        from collections import Counter
        # Group by party → majority choice
        party_choices: dict[str, list[str]] = {}
        for row in rows:
            pid = (row.get("politicians") or {}).get("party_id")
            if pid:
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

            party_id_map: dict[str, str] = {}
            for pb in detail.party_breakdown:
                pid = self._upsert_party(pb.abbreviation, pb.name)
                if pid:
                    party_id_map[pb.abbreviation] = pid

            for dv in detail.deputy_votes:
                party_id = party_id_map.get(dv.party_abbr)
                if not party_id and dv.party_abbr:
                    party_id = self._upsert_party(dv.party_abbr, dv.party_abbr)
                    if party_id:
                        party_id_map[dv.party_abbr] = party_id

                pol_id = self._upsert_politician(dv.last_name, dv.first_name, party_id)
                if not pol_id:
                    log.warning("Could not upsert deputy %s %s", dv.first_name, dv.last_name)
                    continue

                self.db.table("politician_votes").upsert(
                    {
                        "politician_id": pol_id,
                        "vote_id": vote_id,
                        "vote_choice": dv.vote_choice,
                        "party_line_deviation": False,
                    },
                    on_conflict="politician_id,vote_id",
                ).execute()

            self._compute_deviations(vote_id)
            return True

        except Exception as exc:  # noqa: BLE001
            log.error("store_detail failed for idv=%d: %s", detail.cdep_vote_id, exc, exc_info=True)
            return False

    # ── public scrape methods ──────────────────────────────────

    def scrape_date(self, target: datetime.date) -> None:
        log.info("=== Scraping Camera date: %s ===", target)
        idvs = self.get_idv_list(target)
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
    else:
        start = datetime.date.fromisoformat(args.start)
        end = datetime.date.fromisoformat(args.end)
        scraper.scrape_range(start, end)


if __name__ == "__main__":
    main()
