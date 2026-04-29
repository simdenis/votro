"""
VotRO — Romanian Senate Plenary Vote Scraper
Targets: https://www.senat.ro/VoturiPlen.aspx (index)
         https://www.senat.ro/VoturiPlenDetaliu.aspx (detail)

Enumeration strategy
────────────────────
The index page is an ASP.NET WebForms calendar. Dates are selected via
__doPostBack. The calendar control encodes dates as integer days since
2000-01-01 (confirmed: V9556 navigates to March 1 2026, which is day 9556).

For each target date:
  1. GET /VoturiPlen.aspx  → capture viewstate
  2. POST with V{first_of_month} → navigate calendar to right month
  3. POST with {day_count}  → select the date → response contains vote rows
  4. Extract AppID UUIDs from vote row links
  5. GET /VoturiPlenDetaliu.aspx?AppID={uuid} for each vote

Upsert keys (idempotent):
  laws             → code
  parties          → abbreviation
  politicians      → (name, first_name)
  votes            → senat_app_id
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
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag
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
log = logging.getLogger("votro")


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


@dataclass
class PartyBreakdown:
    name: str = ""
    abbreviation: str = ""
    for_: int = 0
    against: int = 0
    abstentions: int = 0
    not_voted: int = 0


@dataclass
class SenatorVote:
    last_name: str = ""
    first_name: str = ""
    party_abbr: str = ""
    vote_choice: str = "absent"  # for | against | abstention | not_voted | absent


@dataclass
class VoteDetail:
    app_id: str = ""
    law_code: str = ""
    law_title: str = ""
    vote_date: Optional[datetime.date] = None
    vote_type: str = ""
    totals: VoteTotals = field(default_factory=VoteTotals)
    party_breakdown: list[PartyBreakdown] = field(default_factory=list)
    senator_votes: list[SenatorVote] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────
# Scraper
# ──────────────────────────────────────────────────────────────
class SenatScraper:
    BASE_URL = "https://www.senat.ro"
    INDEX_URL = "https://www.senat.ro/VoturiPlen.aspx"
    DETAIL_URL = "https://www.senat.ro/VoturiPlenDetaliu.aspx"

    # ASP.NET control IDs (found in the page source)
    CAL_CONTROL = "ctl00$B_Center$VoturiPlen1$calVOT"
    GRID_CONTROL = "ctl00$B_Center$VoturiPlen1$GridVoturi"

    # Days-since-2000-01-01 epoch confirmed by observing V9556 = 2026-03-01
    CAL_EPOCH = datetime.date(2000, 1, 1)

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
        self.session.headers.update(
            {
                "User-Agent": (
                    "VotRO/1.0 Romanian parliamentary vote tracker "
                    "(research; contact: siminiucdenis@gmail.com)"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
            }
        )

        self.db: Client = create_client(supabase_url, supabase_key)

        # run-level stats
        self._stats = {"votes_scraped": 0, "votes_skipped": 0, "errors": 0}
        self._seen_politicians: set[str] = set()

    # ── helpers ────────────────────────────────────────────────

    def _delay(self) -> None:
        time.sleep(random.uniform(self.delay_min, self.delay_max))

    def _to_cal_days(self, d: datetime.date) -> int:
        return (d - self.CAL_EPOCH).days

    def _fetch(
        self,
        url: str,
        method: str = "GET",
        data: Optional[dict] = None,
        max_retries: int = 3,
    ) -> Optional[requests.Response]:
        for attempt in range(max_retries):
            try:
                if method == "POST":
                    r = self.session.post(url, data=data, timeout=30)
                else:
                    r = self.session.get(url, timeout=30)
                if r.status_code in (404, 410):
                    log.debug("404/410 for %s", url)
                    return None
                r.raise_for_status()
                r.encoding = "utf-8"
                return r
            except requests.HTTPError as exc:
                log.warning("HTTP %s on attempt %d for %s", exc.response.status_code, attempt + 1, url)
            except requests.RequestException as exc:
                log.warning("Request error on attempt %d for %s: %s", attempt + 1, url, exc)
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                log.info("Waiting %ss before retry…", wait)
                time.sleep(wait)
        log.error("Gave up fetching %s after %d attempts", url, max_retries)
        return None

    @staticmethod
    def _viewstate(html: str) -> dict:
        soup = BeautifulSoup(html, "lxml")
        fields = {}
        for fid in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "__VIEWSTATEENCRYPTED"):
            tag = soup.find("input", {"id": fid})
            if tag:
                fields[fid] = tag.get("value", "")
        return fields

    # ── calendar navigation ────────────────────────────────────

    def _get_votes_html_for_date(self, target: datetime.date) -> Optional[str]:
        """
        Use ASP.NET postback to navigate the calendar and return the HTML for
        the vote list on `target`. Returns None on failure.
        """
        # Step 1 — fresh GET to obtain a valid viewstate
        log.debug("GET index page for viewstate…")
        r = self._fetch(self.INDEX_URL)
        if not r:
            return None
        vs = self._viewstate(r.text)

        # Step 2 — navigate to the correct month
        first_of_month = target.replace(day=1)
        month_arg = f"V{self._to_cal_days(first_of_month)}"
        log.debug("Navigating to month %s (arg=%s)", first_of_month, month_arg)
        self._delay()
        r = self._fetch(
            self.INDEX_URL,
            method="POST",
            data={
                **vs,
                "__EVENTTARGET": self.CAL_CONTROL,
                "__EVENTARGUMENT": month_arg,
            },
        )
        if not r:
            return None
        vs = self._viewstate(r.text)

        # Step 3 — select the specific date
        day_arg = str(self._to_cal_days(target))
        log.debug("Selecting date %s (arg=%s)", target, day_arg)
        self._delay()
        r = self._fetch(
            self.INDEX_URL,
            method="POST",
            data={
                **vs,
                "__EVENTTARGET": self.CAL_CONTROL,
                "__EVENTARGUMENT": day_arg,
            },
        )
        if not r:
            return None

        return r.text

    def get_app_ids_for_date(self, target: datetime.date) -> list[str]:
        """Return all AppID UUIDs for votes on `target`."""
        html = self._get_votes_html_for_date(target)
        if not html:
            log.warning("No index HTML for %s", target)
            return []

        soup = BeautifulSoup(html, "lxml")
        app_ids: list[str] = []
        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            if "VoturiPlenDetaliu" in href:
                m = re.search(r"AppID=([0-9a-fA-F\-]{36})", href)
                if m and m.group(1) not in app_ids:
                    app_ids.append(m.group(1))

        # Also handle pagination — the grid can have multiple pages
        # Detect "next page" links and collect them too
        pagination_pages = set()
        for a in soup.find_all("a", href=True):
            if "Page$" in str(a.get("href", "")):
                # ASP.NET pager link stored as href="#" with __doPostBack
                pass
        # Detect via onclick / doPostBack in pager cells
        for tag in soup.find_all(onclick=True):
            m = re.search(r"Page\$(\d+)", tag["onclick"])
            if m:
                pagination_pages.add(int(m.group(1)))

        if pagination_pages:
            vs = self._viewstate(html)
            for page_num in sorted(pagination_pages):
                log.debug("Fetching index page %d for %s", page_num, target)
                self._delay()
                r = self._fetch(
                    self.INDEX_URL,
                    method="POST",
                    data={
                        **vs,
                        "__EVENTTARGET": self.GRID_CONTROL,
                        "__EVENTARGUMENT": f"Page${page_num}",
                    },
                )
                if r:
                    vs = self._viewstate(r.text)
                    for a in BeautifulSoup(r.text, "lxml").find_all("a", href=True):
                        href = a["href"]
                        if "VoturiPlenDetaliu" in href:
                            mm = re.search(r"AppID=([0-9a-fA-F\-]{36})", href)
                            if mm and mm.group(1) not in app_ids:
                                app_ids.append(mm.group(1))

        log.info("Found %d vote(s) on %s", len(app_ids), target)
        return app_ids

    # ── detail page parsing ────────────────────────────────────

    def fetch_and_parse_detail(self, app_id: str) -> Optional[VoteDetail]:
        url = f"{self.DETAIL_URL}?AppID={app_id}"
        log.info("Fetching vote detail: AppID=%s", app_id)
        r = self._fetch(url)
        if not r:
            return None
        return self._parse_detail(app_id, r.text)

    def _parse_detail(self, app_id: str, html: str) -> Optional[VoteDetail]:
        soup = BeautifulSoup(html, "lxml")
        detail = VoteDetail(app_id=app_id)

        # ── date ──────────────────────────────────────────────
        # Look for "VOTUL ELECTRONIC din DD/MM/YYYY"
        full_text = soup.get_text(" ", strip=True)
        date_match = re.search(r"VOTUL ELECTRONIC\s+din\s+(\d{2}/\d{2}/\d{4})", full_text)
        if date_match:
            detail.vote_date = datetime.datetime.strptime(date_match.group(1), "%d/%m/%Y").date()

        # ── law code + vote type ──────────────────────────────
        # Typical heading: "L95/2026 - vot final"
        code_match = re.search(
            r"\b([A-Z]+\d+/\d{4})\b",
            full_text,
            re.IGNORECASE,
        )
        if code_match:
            detail.law_code = code_match.group(1).upper()

        vote_type_match = re.search(
            r"\b(vot final|vot preliminar|vot de respingere|reexaminare)\b",
            full_text,
            re.IGNORECASE,
        )
        if vote_type_match:
            detail.vote_type = vote_type_match.group(1).lower()

        # ── law title ─────────────────────────────────────────
        # The page uses <h5> for the bill description text.
        title_tag = (
            soup.find("h5")
            or soup.find("span", id=re.compile(r"LblTitlu|lblTitlu|lblDescr|LblDescr", re.I))
            or soup.find("td", class_=re.compile(r"titlu|title", re.I))
        )
        if title_tag:
            detail.law_title = title_tag.get_text(" ", strip=True)
        else:
            # Fallback: look for the longest <td> or <p> near the law code
            candidates = [
                t.get_text(" ", strip=True)
                for t in soup.find_all(["td", "p", "div"])
                if len(t.get_text(strip=True)) > 40
                and re.search(r"(lege|ordonan|hotãr|hotărâ|proiect)", t.get_text(), re.I)
            ]
            if candidates:
                detail.law_title = max(candidates, key=len)

        # ── vote totals ───────────────────────────────────────
        detail.totals = self._parse_totals(soup)

        # ── party breakdown ───────────────────────────────────
        detail.party_breakdown = self._parse_party_breakdown(soup)

        # ── per-senator votes ─────────────────────────────────
        detail.senator_votes = self._parse_senator_votes(soup)

        if not detail.law_code:
            log.warning("AppID=%s: could not extract law code", app_id)
        if not detail.vote_date:
            log.warning("AppID=%s: could not extract vote date", app_id)
        if not detail.senator_votes:
            log.warning("AppID=%s: senator vote list is empty", app_id)

        log.info(
            "Parsed %s (%s) | %d senators | totals: %d/%d/%d",
            detail.law_code or "?",
            detail.vote_date or "?",
            len(detail.senator_votes),
            detail.totals.for_,
            detail.totals.against,
            detail.totals.abstentions,
        )
        return detail

    def _parse_totals(self, soup: BeautifulSoup) -> VoteTotals:
        totals = VoteTotals()

        # Primary: <ul><li>Label: <strong>N</strong></li> pattern.
        # The site uses cedilla-ţ (U+0163) in "Prezenţi" / "Abţineri",
        # distinct from the comma-below ț (U+021B) used in modern Romanian.
        for li in soup.find_all("li"):
            strong = li.find("strong")
            if not strong:
                continue
            raw = strong.get_text(strip=True)
            if not raw.isdigit():
                continue
            val = int(raw)
            label = li.get_text(" ", strip=True).lower()
            if re.search(r"prezen[tțţ]i", label):
                totals.present = val
            elif re.match(r"pentru", label):
                totals.for_ = val
            elif re.match(r"contra", label):
                totals.against = val
            elif re.search(r"ab[tțţ]ineri", label):
                totals.abstentions = val
            elif re.search(r"nu au votat", label):
                totals.not_voted = val

        # Fallback: regex scan of full-page text (handles layout variations)
        if totals.present == 0 and totals.for_ == 0 and totals.against == 0:
            text = soup.get_text(" ", strip=True)

            def _extract(pattern: str) -> int:
                m = re.search(pattern, text, re.IGNORECASE)
                return int(m.group(1)) if m else 0

            totals.present = _extract(r"Prezen[tțţ]i[:\s]+(\d+)")
            totals.for_ = _extract(r"Pentru[:\s]+(\d+)")
            totals.against = _extract(r"Contra[:\s]+(\d+)")
            totals.abstentions = _extract(r"Ab[tțţ]ineri[:\s]+(\d+)")
            totals.not_voted = _extract(r"Nu\s+au\s+votat[:\s]+(\d+)")

        return totals

    def _parse_party_breakdown(self, soup: BeautifulSoup) -> list[PartyBreakdown]:
        """
        Find the party-aggregate table. It contains one row per party with
        columns: (logo/name) | Pentru | Contra | Abțineri | Nu au votat
        """
        breakdown: list[PartyBreakdown] = []

        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue
            header_text = " ".join(th.get_text(strip=True).lower() for th in rows[0].find_all(["th", "td"]))
            if "pentru" not in header_text or "contra" not in header_text:
                continue
            # This looks like the right table
            for row in rows[1:]:
                cells = row.find_all(["td", "th"])
                if len(cells) < 4:
                    continue
                # First cell = party name (may contain an <img> and text)
                party_text = cells[0].get_text(" ", strip=True)
                if not party_text or re.match(r"^\d+$", party_text):
                    continue

                def _int(cell: Tag) -> int:
                    try:
                        return int(re.sub(r"\D", "", cell.get_text(strip=True)) or "0")
                    except ValueError:
                        return 0

                pb = PartyBreakdown(
                    name=party_text,
                    abbreviation=_abbreviate(party_text),
                    for_=_int(cells[1]),
                    against=_int(cells[2]),
                    abstentions=_int(cells[3]),
                    not_voted=_int(cells[4]) if len(cells) > 4 else 0,
                )
                breakdown.append(pb)
            break  # stop after first matching table

        return breakdown

    def _parse_senator_votes(self, soup: BeautifulSoup) -> list[SenatorVote]:
        """
        Find the per-senator table. Expected columns:
          Nume | Prenume | Grup Parlamentar | Pentru | Contra | Abțineri | Nu au votat | Modalitate
        Vote choice columns contain "X" (or similar marker) for the chosen option.
        """
        senator_votes: list[SenatorVote] = []

        # Find the largest table with "X" markers for votes
        best_table = None
        best_row_count = 0
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) <= best_row_count:
                continue
            header_row = rows[0]
            header_text = " ".join(c.get_text(strip=True).lower() for c in header_row.find_all(["th", "td"]))
            if "pentru" in header_text and ("nume" in header_text or "prenume" in header_text):
                best_table = table
                best_row_count = len(rows)

        if not best_table:
            log.warning("Could not find senator vote table")
            return []

        rows = best_table.find_all("tr")
        # Determine column indices from header
        header_cells = [c.get_text(strip=True).lower() for c in rows[0].find_all(["th", "td"])]

        def _col(keywords: list[str]) -> int:
            for i, h in enumerate(header_cells):
                if any(kw in h for kw in keywords):
                    return i
            return -1

        col_last = _col(["nume"])
        col_first = _col(["prenume"])
        col_party = _col(["grup", "partid"])
        col_for = _col(["pentru"])
        col_against = _col(["contra"])
        col_abstain = _col(["abțineri", "abtineri", "abţineri"])
        col_notvoted = _col(["nu au votat", "prezent"])

        # If column detection failed, fall back to positional guesses
        if col_last < 0:
            col_last = 0
        if col_first < 0:
            col_first = 1
        if col_party < 0:
            col_party = 2
        if col_for < 0:
            col_for = 3
        if col_against < 0:
            col_against = 4
        if col_abstain < 0:
            col_abstain = 5
        if col_notvoted < 0:
            col_notvoted = 6

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) <= col_for:
                continue

            def _txt(idx: int) -> str:
                if idx < 0 or idx >= len(cells):
                    return ""
                return cells[idx].get_text(" ", strip=True)

            def _marked(idx: int) -> bool:
                if idx < 0 or idx >= len(cells):
                    return False
                cell_text = cells[idx].get_text(strip=True).upper()
                # Look for "X", "✓", non-empty after stripping whitespace
                return bool(cell_text and cell_text not in ("-", "0"))

            last = _txt(col_last)
            first = _txt(col_first)
            if not last and not first:
                continue  # empty row

            # Determine vote choice
            if _marked(col_for):
                choice = "for"
            elif _marked(col_against):
                choice = "against"
            elif _marked(col_abstain):
                choice = "abstention"
            elif _marked(col_notvoted):
                choice = "not_voted"
            else:
                choice = "absent"

            senator_votes.append(
                SenatorVote(
                    last_name=last,
                    first_name=first,
                    party_abbr=_abbreviate(_txt(col_party)),
                    vote_choice=choice,
                )
            )

        return senator_votes

    # ── Supabase storage ───────────────────────────────────────

    def _upsert_party(self, abbreviation: str, name: str) -> Optional[str]:
        if not abbreviation:
            return None
        res = (
            self.db.table("parties")
            .upsert({"abbreviation": abbreviation, "name": name}, on_conflict="abbreviation")
            .execute()
        )
        if res.data:
            return res.data[0]["id"]
        # Fetch existing
        res2 = self.db.table("parties").select("id").eq("abbreviation", abbreviation).execute()
        return res2.data[0]["id"] if res2.data else None

    def _upsert_politician(
        self,
        last_name: str,
        first_name: str,
        party_id: Optional[str],
    ) -> Optional[str]:
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

        payload: dict = {"name": last_name, "first_name": first_name, "chamber": "senate"}
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
        res = (
            self.db.table("laws")
            .upsert(payload, on_conflict="code")
            .execute()
        )
        if res.data:
            return res.data[0]["id"]
        res2 = self.db.table("laws").select("id").eq("code", code).execute()
        return res2.data[0]["id"] if res2.data else None

    def _upsert_vote(
        self,
        law_id: Optional[str],
        detail: VoteDetail,
    ) -> Optional[str]:
        t = detail.totals
        if t.for_ > 0 or t.against > 0:
            outcome = "adoptat" if t.for_ > t.against else "respins"
        else:
            outcome = None
        payload = {
            "senat_app_id": detail.app_id,
            "vote_date": detail.vote_date.isoformat() if detail.vote_date else None,
            "vote_type": detail.vote_type,
            "present_count": t.present,
            "for_count": t.for_,
            "against_count": t.against,
            "abstention_count": t.abstentions,
            "not_voted_count": t.not_voted,
            "outcome": outcome,
        }
        if law_id:
            payload["law_id"] = law_id

        res = (
            self.db.table("votes")
            .upsert(payload, on_conflict="senat_app_id")
            .execute()
        )
        if res.data:
            return res.data[0]["id"]
        res2 = self.db.table("votes").select("id").eq("senat_app_id", detail.app_id).execute()
        return res2.data[0]["id"] if res2.data else None

    def store_detail(self, detail: VoteDetail) -> bool:
        """Persist a VoteDetail to Supabase. Returns True on success."""
        try:
            # 1. Law
            law_id = self._upsert_law(detail.law_code, detail.law_title)

            # 2. Vote session
            vote_id = self._upsert_vote(law_id, detail)
            if not vote_id:
                log.error("Failed to upsert vote for AppID=%s", detail.app_id)
                return False

            # 3. Parties & politicians & their votes
            # Build party-abbr → party_id map from breakdown (most reliable source of party names)
            party_id_map: dict[str, str] = {}
            for pb in detail.party_breakdown:
                pid = self._upsert_party(pb.abbreviation, pb.name)
                if pid:
                    party_id_map[pb.abbreviation] = pid

            # Upsert each senator vote
            for sv in detail.senator_votes:
                party_id = party_id_map.get(sv.party_abbr)
                if not party_id and sv.party_abbr:
                    # Party not in breakdown (e.g. independent) — create it
                    party_id = self._upsert_party(sv.party_abbr, sv.party_abbr)

                pol_id = self._upsert_politician(sv.last_name, sv.first_name, party_id)
                if not pol_id:
                    log.warning("Could not upsert politician %s %s", sv.first_name, sv.last_name)
                    continue

                self.db.table("politician_votes").upsert(
                    {
                        "politician_id": pol_id,
                        "vote_id": vote_id,
                        "vote_choice": sv.vote_choice,
                        "party_line_deviation": False,  # computed below
                    },
                    on_conflict="politician_id,vote_id",
                ).execute()

            # 4. Compute party-line deviations for this vote
            self._compute_deviations(vote_id)

            return True

        except Exception as exc:  # noqa: BLE001
            log.error("store_detail failed for AppID=%s: %s", detail.app_id, exc, exc_info=True)
            return False

    def _compute_deviations(self, vote_id: str) -> None:
        """
        For each party in this vote, find the plurality choice (for/against/abstention).
        Any senator who voted differently gets party_line_deviation = True.
        """
        res = (
            self.db.table("politician_votes")
            .select("id, vote_choice, politicians(party_id)")
            .eq("vote_id", vote_id)
            .execute()
        )
        if not res.data:
            return

        # Group choices by party
        party_choices: dict[str, list[str]] = {}
        for row in res.data:
            party_id = (row.get("politicians") or {}).get("party_id")
            if not party_id:
                continue
            party_choices.setdefault(party_id, []).append(row["vote_choice"])

        # Find majority (excluding absent/not_voted)
        VALID = {"for", "against", "abstention"}
        party_majority: dict[str, str] = {}
        for pid, choices in party_choices.items():
            counter = Counter(c for c in choices if c in VALID)
            if counter:
                party_majority[pid] = counter.most_common(1)[0][0]

        # Update each row
        for row in res.data:
            party_id = (row.get("politicians") or {}).get("party_id")
            majority = party_majority.get(party_id) if party_id else None
            deviation = (majority is not None) and (row["vote_choice"] != majority) and (row["vote_choice"] in VALID)
            self.db.table("politician_votes").update(
                {"party_line_deviation": deviation}
            ).eq("id", row["id"]).execute()

    # ── public API ─────────────────────────────────────────────

    def already_scraped(self, app_id: str) -> bool:
        res = self.db.table("votes").select("id").eq("senat_app_id", app_id).execute()
        return bool(res.data)

    def fill_missing_senator_votes(self) -> None:
        """Re-scrape all votes in the DB that have no politician_votes records."""
        all_votes = self.db.table("votes").select("id, senat_app_id, vote_date").execute().data
        pv_ids    = {
            r["vote_id"]
            for r in self.db.table("politician_votes").select("vote_id").execute().data
        }

        missing = [v for v in all_votes if v["id"] not in pv_ids]
        log.info("Found %d votes with no senator records — re-scraping", len(missing))

        for i, vote in enumerate(missing):
            app_id = vote["senat_app_id"]
            log.info("[%d/%d] Re-scraping AppID=%s (%s)", i + 1, len(missing), app_id, vote["vote_date"])
            self._delay()
            detail = self.fetch_and_parse_detail(app_id)
            if not detail:
                self._stats["errors"] += 1
                continue
            if not detail.senator_votes:
                log.warning("Still no senator data for AppID=%s — skipping", app_id)
                continue
            ok = self.store_detail(detail)
            if ok:
                self._stats["votes_scraped"] += 1
            else:
                self._stats["errors"] += 1

        self.print_summary()

    def scrape_date(self, target: datetime.date) -> None:
        log.info("=== Scraping date: %s ===", target)
        app_ids = self.get_app_ids_for_date(target)
        if not app_ids:
            log.info("No votes found on %s", target)
            return

        for app_id in app_ids:
            if self.already_scraped(app_id):
                log.info("Already scraped AppID=%s — skipping", app_id)
                self._stats["votes_skipped"] += 1
                continue

            self._delay()
            detail = self.fetch_and_parse_detail(app_id)
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
        print("VotRO scraper — run summary")
        print("=" * 50)
        print(f"  Votes scraped   : {self._stats['votes_scraped']}")
        print(f"  Votes skipped   : {self._stats['votes_skipped']} (already in DB)")
        print(f"  Politicians seen: {len(self._seen_politicians)}")
        print(f"  Errors          : {self._stats['errors']}")
        print("=" * 50)


# ──────────────────────────────────────────────────────────────
# Law category classifier
# ──────────────────────────────────────────────────────────────
# Ordered from most specific to least specific.
# Uses case-insensitive regex; first match wins.
_CATEGORY_RULES: list[tuple[str, str]] = [
    ("Sănătate",      r"sănătat|medical|spital|farmaceut|sanitar|clinică|stomatolog|medicament|asigurări.*sănătate"),
    ("Educație",      r"educaț|învățăm|universit|student|didact|școlar|academic|cercetare"),
    ("Justiție",      r"penal|cod penal|recidiv|infracțiu|judecăt|procuror|avocat|execut.*silit|insolv|tribunal|contravențional"),
    ("Social",        r"social|familie|copil|femicid|violenț.*domestic|pensii|pensionar|muncă|salariu|șomaj|ajutor.*social|discriminar"),
    ("Infrastructură",r"autostrad|drum|feroviar|metrou|cale ferată|rutier|port |aeroport|pod |tunel|infrastructur"),
    ("Transport",     r"transport|trafic|circulaț|vehicul|auto"),
    ("Agricultură",   r"agricult|rural|produse agricole|silvic|fond funciar|pădure|defrișare|pescuit|acvacult"),
    ("Mediu",         r"mediu|ecolog|climă|deșeuri|reciclare|biodiversit|arii protejate|poluare|apă potabilă"),
    ("Energie",       r"energie|petrol|gaze|electricitate|nuclear|regenerab|cărbune|combustibil"),
    ("Apărare",       r"apărare|militar|armată|securitate națională|nato|armament|servicii secrete"),
    ("Economie",      r"fiscal|buget|impozit|taxe|tva|financiar|datorie publică|economie|comerț|investiț|capital|bursă"),
    ("Tehnologie",    r"digital|informatică|cibernetic|date personale|gdpr|inteligență artificială|software|cloud|internet"),
    ("Administrație", r"administraț|funcționar public|primărie|consiliu local|descentralizar|servicii publice"),
]

_CATEGORY_PATTERNS = [
    (cat, re.compile(pat, re.IGNORECASE))
    for cat, pat in _CATEGORY_RULES
]


def _classify_law(title: str) -> Optional[str]:
    for category, pattern in _CATEGORY_PATTERNS:
        if pattern.search(title):
            return category
    return None


# ──────────────────────────────────────────────────────────────
# Utility
# ──────────────────────────────────────────────────────────────
# Map of known Romanian party names → canonical abbreviation
_PARTY_ABBREV_MAP: dict[str, str] = {
    "alianța pentru unitatea românilor": "AUR",
    "partidul România în acțiune": "PIR",
    "partidul national liberal": "PNL",
    "partidul social democrat": "PSD",
    "uniunea democrată maghiară din România": "UDMR",
    "uniunea salvați România": "USR",
    "pro România": "PRO",
    "forța dreptei": "FD",
    "independenți": "IND",
    "neafiliați": "IND",
}


def _abbreviate(raw: str) -> str:
    """
    Return a short abbreviation for a party name.
    Tries a lookup table first; falls back to extracting uppercase letters.
    """
    if not raw:
        return ""
    lower = raw.lower().strip()
    for key, abbr in _PARTY_ABBREV_MAP.items():
        if key in lower:
            return abbr
    # Use the text as-is if it's already short (≤6 chars and all caps)
    stripped = re.sub(r"\s+", "", raw).upper()
    if len(stripped) <= 6 and re.match(r"^[A-ZĂÎȘȚÂ]+$", stripped):
        return stripped
    # Extract uppercase acronym
    words = raw.split()
    acronym = "".join(w[0].upper() for w in words if w and re.match(r"^[A-ZĂÎȘȚÂ]", w))
    return acronym[:6] if acronym else raw[:6].upper()


# ──────────────────────────────────────────────────────────────
# CLI entry point
# ──────────────────────────────────────────────────────────────
def main() -> None:
    import argparse

    load_dotenv()

    parser = argparse.ArgumentParser(description="VotRO — Romanian Senate vote scraper")
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
    parser.add_argument("--fill-missing", action="store_true",
                        help="Re-scrape votes in DB that have no senator records")
    parser.add_argument("--app-id", metavar="UUID",
                        help="Re-scrape a single vote by its AppID UUID")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env or environment.")
        sys.exit(1)

    delay_min = float(os.environ.get("SCRAPER_DELAY_MIN", "1.0"))
    delay_max = float(os.environ.get("SCRAPER_DELAY_MAX", "2.0"))

    scraper = SenatScraper(url, key, delay_min=delay_min, delay_max=delay_max)

    if args.app_id:
        detail = scraper.fetch_and_parse_detail(args.app_id)
        if not detail:
            print(f"ERROR: could not fetch/parse AppID={args.app_id}")
            sys.exit(1)
        ok = scraper.store_detail(detail)
        scraper._stats["votes_scraped" if ok else "errors"] += 1
        scraper.print_summary()
    elif args.fill_missing:
        scraper.fill_missing_senator_votes()
    elif args.date:
        scraper.scrape_date(datetime.date.fromisoformat(args.date))
        scraper.print_summary()
    else:
        start = datetime.date.fromisoformat(args.start)
        end = datetime.date.fromisoformat(args.end)
        scraper.scrape_range(start, end)


if __name__ == "__main__":
    main()
