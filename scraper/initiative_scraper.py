"""Every filed parliamentary initiative — including the ones that never reach
a plenary vote and sit in committee (the site's "fără vot în plen" view).

Two registries, linked into one row per initiative:

  cdep annual listing  /ords/pls/proiecte/upl_pck2015.lista?cam=2&anp={YYYY}
      one <tr> per initiative: idp, "Pl-x N/DD.MM.YYYY" (registration date is
      inside the code), title, current stage cell ("la comisii", "la Senat",
      "Lege N/YYYY", "respinsa definitiv", …) with its date. cam=1 returns
      ~nothing — Senate-first bills come from the L registry below.
  cdep fișă            upl_pck2015.proiect?idp={id}
      "Obiect de reglementare" (official plain description), "Camera
      decizionala:", and the Senate cross-ref link nr_cls=L{n}&an_cls={yyyy}.
  senat L-registry     senat.ro/legis/lista.aspx?nr_cls=L{n}&an_cls={yyyy}
      grid row (code / title / official Stadiu) + the full legislative journey
      ("DD-MM-YYYY | action" rows): first row = registration, "trimis pentru
      raport la Comisia …" = committee_since, plenary decisions, the cdep
      cross-ref "(adresa nr.plx425/2025…)". L numbers are dense per year —
      new ones are found by probing past the max known number. The year/
      committee dropdowns POST but do NOT filter server-side — never use them.

CRITICAL semantics: a tally "(pentru respingere)" / "vot final (respingere)"
is ON A REJECTION — "adoptat"/FOR winning means the bill was REJECTED (same
rule as senat_scraper since 1e8af70). normalize_stage() mirrors
frontend/lib/initiative-stage.ts — change them together.

senat.ro sometimes serves complete-looking but empty pages — the grid marker
is the validity check, empty responses are retried, and a sanity floor guards
every bulk write. cdep.ro drops non-EU IPs — run on the EU VPS.

Usage:
    python initiative_scraper.py                 # daily incremental (run_daily)
    python initiative_scraper.py --backfill      # full sweep, checkpointed +
                                                 #   resumable (nohup it)
    python initiative_scraper.py --dry-run --limit 20
    python initiative_scraper.py --senat-code L108/2026   # debug one, no DB
"""
from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import random
import re
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paging import fetch_all
from senat_scraper import _classify_law, _repair_mojibake

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("initiative")
logging.getLogger("httpx").setLevel(logging.WARNING)

UA = {
    "User-Agent": (
        "VotRO/1.0 Romanian parliamentary vote tracker "
        "(research; contact: siminiucdenis@gmail.com)"
    )
}
CDEP_LIST = "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.lista"
CDEP_FISA = "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect"
SENAT_FISA = "https://www.senat.ro/legis/lista.aspx"
SENAT_GRID = "ctl00_B_Center_Lista_grdLista"
SENAT_LINK = re.compile(r"lista\.aspx\?nr_cls=(L\d+)&(?:amp;)?an_cls=(\d{4})")
CDEP_XREF = re.compile(r"nr\.?\s*plx\s*(\d+)/(\d{4})", re.I)

FIRST_YEAR = 2025  # current legislature's first full year
FINAL_STAGES = {"promulgat", "respins_definitiv", "procedura_incetata", "retras"}
# terminal beats pre-promulgation beats working; within a rank the later date wins
STAGE_RANK = {s: 3 for s in FINAL_STAGES} | {"la_ccr": 2, "adoptat_final": 2}
PROBE_MISSES = 10  # consecutive unknown L numbers before the registry is exhausted


def _strip(s: str) -> str:
    import unicodedata
    return "".join(
        c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c)
    )


def _text(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).replace("\xa0", " ").strip()


def normalize_stage(raw: str, *, decisional: bool = False, decided_first: bool = False) -> str | None:
    """Official stage wording → enum. Mirror of frontend/lib/initiative-stage.ts."""
    t = re.sub(r"\s+", " ", _strip(raw)).strip()
    if not t:
        return None
    if re.search(r"\blege\b\s*(nr\.?\s*)?\d+/\d{4}", t) or "promulgat" in t:
        return "promulgat"
    if re.search(r"neconstitutionalitat|curtea constitutional|sesizare.*ccr|\bccr\b", t):
        return "la_ccr"
    if re.search(r"respins(a)? definitiv", t):
        return "respins_definitiv"
    if re.search(r"procedura legislativa incetata|incetarea procedurii", t):
        return "procedura_incetata"
    if re.search(r"retras|retragere", t):
        return "retras"
    if re.search(r"la promulgare|la secretarul general|dreptului de sesizare|reexaminar", t):
        return "adoptat_final"
    # ── plenary decisions — the "(respingere)" inversion lives here ──
    if re.search(r"respins(a)? (propunerea|raportul) de respingere", t):
        return None  # rejection report failed — no decision yet
    if re.search(r"\(pentru respingere\)|vot final \(respingere\)", t) or re.search(
        r"(\(respingere\)|propunerea de respingere|raportul de respingere).*adoptat"
        r"|adoptat.*(\(respingere\)|propunerea de respingere|raportul de respingere)", t):
        return "respins_definitiv" if decisional else "respins_prima"
    if re.search(r"respins(a)? de( catre)? (senat|camera)", t):
        return "respins_definitiv" if decisional else "respins_prima"
    if re.search(r"adoptat(a)? de( catre)? (senat|camera)", t):  # incl. tacit (art. 75)
        return "adoptat_final" if decisional else "adoptat_prima"
    if re.match(r"la senat\b|la camera deputatilor\b", t):
        return "la_decizionala"
    working = (
        "raport_depus" if re.search(r"raport depus|depune raportul", t)
        else "ordinea_zi" if "ordinea de zi" in t
        else "in_comisie" if re.search(
            r"la comisi|trimis pentru raport|in lucru|retrimis la comisi|aviz/? punct de vedere solicitat", t)
        else None
    )
    if working:
        return "la_decizionala" if decided_first else working
    return None


class InitiativeScraper:
    def __init__(self, delay_min: float = 0.3, delay_max: float = 0.5) -> None:
        self.delay_min, self.delay_max = delay_min, delay_max
        self.session = requests.Session()
        self.session.headers.update(UA)

    def _fetch(self, url: str, params: dict | None = None, *, valid: str | None = None) -> str | None:
        """GET with politeness delay + 3 retries. `valid` is a substring the
        page must contain — senat.ro sometimes serves complete-looking but
        empty responses, which must read as fetch failure, never as data."""
        for attempt in range(3):
            time.sleep(random.uniform(self.delay_min, self.delay_max))
            try:
                r = self.session.get(url, params=params, timeout=30)
                r.raise_for_status()
                r.encoding = "utf-8"
                if valid and valid not in r.text:
                    raise requests.RequestException(f"marker {valid!r} missing")
                return r.text
            except requests.RequestException as exc:
                log.warning("attempt %d failed for %s: %s", attempt + 1, url, exc)
                if attempt < 2:
                    time.sleep(2 ** (attempt + 1))
        log.error("gave up fetching %s %s", url, params or "")
        return None

    # ── cdep ───────────────────────────────────────────────────

    def cdep_listing(self, year: int) -> list[dict] | None:
        html = self._fetch(CDEP_LIST, {"cam": "2", "anp": str(year)}, valid="upl_pck2015.proiect")
        if html is None:
            return None
        rows = []
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
            link = re.search(r'upl_pck2015\.proiect\?[^"]*idp=(\d+)', row)
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
            if not link or len(cells) < 4:
                continue
            code = re.search(r"(?:PL|Pl)-x\s*(\d+)/(\d{2})\.(\d{2})\.(\d{4})", _text(cells[1]))
            if not code:
                continue
            stage_cell = _text(cells[3])
            dates = re.findall(r"(\d{2})\.(\d{2})\.(\d{4})", stage_cell)
            stage_date = dates[-1] if dates else None
            stage_raw = re.sub(r"\s*\d{2}\.\d{2}\.\d{4}\s*$", "", stage_cell).strip()
            rows.append({
                "cdep_code": f"PLx{code.group(1)}/{code.group(4)}",
                "cdep_idp": int(link.group(1)),
                "title": _repair_mojibake(_text(cells[2]))[:600] or None,
                "registered_date": f"{code.group(4)}-{code.group(3)}-{code.group(2)}",
                "stage_raw": stage_raw or None,
                "stage_date": f"{stage_date[2]}-{stage_date[1]}-{stage_date[0]}" if stage_date else None,
            })
        return rows

    def cdep_fisa(self, idp: int, num: str, year: str) -> dict | None:
        html = self._fetch(CDEP_FISA, {"cam": "2", "idp": str(idp)}, valid="Obiect de reglementare")
        if html is None:
            return None
        # cdep answers 200 even for unknown ids — confirm the fișă is about
        # this project before trusting anything on it (same guard as resolve_plx)
        if not re.search(rf"-x\s*{num}/{year}\b", html):
            log.warning("fișă idp=%s is not about PLx%s/%s — skipping", idp, num, year)
            return None
        out: dict = {}
        m = re.search(r"Obiect de reglementare:\s*</td>\s*<td[^>]*>(.*?)</td>", html, re.S)
        if m:
            out["obiect"] = _repair_mojibake(_text(m.group(1)))[:2000] or None
        m = re.search(r"Camera decizionala:\s*</td>\s*<td[^>]*>(.*?)</td>", html, re.S)
        if m:
            dec = _strip(_text(m.group(1)))
            if "senat" in dec and "camera" not in dec:
                out["chamber_first"] = "deputies"
            elif "camera deputatilor" in dec and "senat" not in dec:
                out["chamber_first"] = "senate"
        codes = {f"{c.group(1)}/{c.group(2)}" for c in SENAT_LINK.finditer(html)}
        if len(codes) == 1:
            out["senat_code"] = next(iter(codes))
        elif len(codes) > 1:
            log.warning("fișă idp=%s links %d Senate codes %s — not linking", idp, len(codes), sorted(codes))
        return out

    # ── senat ──────────────────────────────────────────────────

    def senat_fisa(self, code: str) -> dict | None:
        """Parse one L-registry fișă. Returns {} when the code doesn't exist
        (registry exhausted), None on fetch failure, data otherwise."""
        nr, year = code.split("/")
        html = self._fetch(SENAT_FISA, {"nr_cls": nr, "an_cls": year}, valid=SENAT_GRID)
        if html is None:
            return None
        grid = re.search(rf'id="{SENAT_GRID}"(.*?)</table>', html, re.S)
        row = next((r for r in re.findall(r"<tr[^>]*>(.*?)</tr>", grid.group(1), re.S)
                    if f">{code}<" in r), None) if grid else None
        if not row:
            return {}  # grid rendered but this L number doesn't exist
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        title = re.search(r"<b>\s*(.*?)</b>", cells[2], re.S) if len(cells) >= 4 else None
        out: dict = {
            "senat_code": code,
            "title": _repair_mojibake(_text(title.group(1)))[:600] if title else None,
            "stadiu": _text(cells[3]) if len(cells) >= 4 else "",
        }

        journey = [
            (f"{m.group(3)}-{m.group(2)}-{m.group(1)}", _text(m.group(4)))
            for m in re.finditer(
                r"<tr[^>]*>\s*<td[^>]*>\s*(\d{2})-(\d{2})-(\d{4})\s*</td>\s*<td[^>]*>(.*?)</td>",
                html, re.S)
        ]
        out["journey"] = journey
        if journey:
            out["registered_date"] = journey[0][0]

        chamber_first = None
        for _, action in journey:
            a = _strip(action)
            if "prima camera sesizata" in a:
                chamber_first = "deputies" if re.search(r"la camera deputatilor.{0,30}ca prima", a) else "senate"
            elif "senatul este camera decizionala" in a:
                chamber_first = "deputies"
            elif "camera deputatilor este camera decizionala" in a:
                chamber_first = "senate"
            m = CDEP_XREF.search(a)
            if m:
                out["cdep_code"] = f"PLx{m.group(1)}/{m.group(2)}"
        out["chamber_first"] = chamber_first

        # walk the journey in order: committee clock + last plenary decision
        decided_first = False
        stage = stage_date = committee_since = None
        for date, action in journey:
            a = _strip(action)
            if re.search(r"trimis pentru raport la", a):
                committee_since = date
            decides = "senate" if re.search(r"de( catre)? senat", a) else \
                      "deputies" if re.search(r"de( catre)? camera", a) else None
            s = normalize_stage(
                action,
                decisional=bool(decides and chamber_first and decides != chamber_first),
                decided_first=decided_first,
            )
            if s in ("adoptat_prima", "respins_prima"):
                decided_first = True
            if chamber_first == "senate" and "inregistrat la camera deputatilor pentru dezbatere" in a:
                decided_first = True
            if s:
                stage, stage_date = s, date
        out["decided_first"] = decided_first
        out["committee_since"] = committee_since
        out["journey_stage"], out["journey_stage_date"] = stage, stage_date
        return out


# ── merging the two legs into one row ──────────────────────────

def build_row(cdep: dict | None, fisa: dict | None, senat: dict | None) -> dict:
    """One initiative from its available pieces. Highest-rank stage wins;
    within a rank the later stage_date; senat journey breaks ties (richer)."""
    row: dict = {}
    chamber_first = (senat or {}).get("chamber_first") or (fisa or {}).get("chamber_first")
    decided_first = bool((senat or {}).get("decided_first"))
    if chamber_first == "senate" and cdep:
        decided_first = True  # it reached the Camera listing, so the Senate leg is done

    candidates: list[tuple[str, str | None]] = []
    if cdep and cdep.get("stage_raw"):
        s = normalize_stage(cdep["stage_raw"],
                            decisional=chamber_first == "senate",
                            decided_first=chamber_first == "senate")
        if s:
            candidates.append((s, cdep.get("stage_date")))
    if senat:
        if senat.get("journey_stage"):
            candidates.append((senat["journey_stage"], senat.get("journey_stage_date")))
        s = normalize_stage(senat.get("stadiu") or "", decided_first=decided_first)
        if s and (STAGE_RANK.get(s, 1) > 1 or not candidates):
            candidates.append((s, senat.get("journey_stage_date")))
    stage, stage_date = (None, None)
    for s, d in candidates:
        if stage is None or (STAGE_RANK.get(s, 1), d or "") > (STAGE_RANK.get(stage, 1), stage_date or ""):
            stage, stage_date = s, d

    reg_dates = [d for d in ((cdep or {}).get("registered_date"), (senat or {}).get("registered_date")) if d]
    stage_raw = (senat or {}).get("stadiu") or (cdep or {}).get("stage_raw")
    if cdep and cdep.get("stage_raw") and stage and normalize_stage(
            cdep["stage_raw"], decisional=chamber_first == "senate",
            decided_first=chamber_first == "senate") == stage:
        stage_raw = cdep["stage_raw"]

    title = (cdep or {}).get("title") or (senat or {}).get("title")
    row.update({
        "cdep_code": (cdep or {}).get("cdep_code") or (senat or {}).get("cdep_code"),
        "senat_code": (senat or {}).get("senat_code") or (fisa or {}).get("senat_code"),
        "cdep_idp": (cdep or {}).get("cdep_idp"),
        "title": title,
        "obiect": (fisa or {}).get("obiect"),
        "registered_date": min(reg_dates) if reg_dates else None,
        "chamber_first": chamber_first,
        "stage_raw": stage_raw,
        "stage": stage,
        "stage_date": stage_date,
        # the CURRENT committee is the most recent referral — a bill back at the
        # decisional chamber must not keep the first chamber's old clock
        "committee_since": max(
            [d for d in (
                (senat or {}).get("committee_since"),
                (cdep or {}).get("stage_date")
                if cdep and normalize_stage(cdep.get("stage_raw") or "") == "in_comisie" else None,
            ) if d],
            default=None),
        "law_category": _classify_law(title) if title else None,
        "scraped_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    })
    return row


# ── checkpoint (backfill resume) ───────────────────────────────

class Checkpoint:
    def __init__(self, path: Path | None) -> None:
        self.path = path
        self.done: dict[str, dict | None] = {}
        if path and path.exists():
            for line in path.read_text().splitlines():
                key, _, payload = line.partition("\t")
                self.done[key] = json.loads(payload) if payload else None
            log.info("checkpoint: %d entries resumed from %s", len(self.done), path)

    def get(self, key: str) -> tuple[bool, dict | None]:
        return key in self.done, self.done.get(key)

    def put(self, key: str, payload: dict | None) -> None:
        self.done[key] = payload
        if self.path:
            with self.path.open("a") as f:
                f.write(f"{key}\t{json.dumps(payload, ensure_ascii=False) if payload is not None else ''}\n")


# ── main flow ──────────────────────────────────────────────────

def run(args: argparse.Namespace) -> int:
    scraper = InitiativeScraper()
    this_year = datetime.date.today().year
    years = list(range(FIRST_YEAR, this_year + 1)) if args.backfill else \
        [y for y in (this_year - 1, this_year) if y >= FIRST_YEAR]
    ckpt = Checkpoint(Path(args.checkpoint) if args.backfill and not args.dry_run else None)

    db = None
    existing_by_code: dict[str, dict] = {}
    existing: list[dict] = []
    if not args.dry_run:
        url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
        if not url or not key:
            sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
        from supabase import create_client
        db = create_client(url, key)
        existing = fetch_all(lambda: db.table("initiatives").select(
            "id,cdep_code,senat_code,cdep_idp,stage,stage_raw,stage_date,obiect,"
            "chamber_first,registered_date,committee_since,law_id"))
        for r in existing:
            for c in (r["cdep_code"], r["senat_code"]):
                if c:
                    existing_by_code[c] = r
        log.info("%d initiatives already in DB", len(existing))

    # 1) cdep listings
    listing_rows: dict[str, dict] = {}
    for year in years:
        rows = scraper.cdep_listing(year)
        if rows is None:
            log.error("cdep listing %d unreachable — aborting (no partial camera view)", year)
            return 1
        # sanity floor: a mostly-empty listing for a past-started year is a
        # broken parse, not an empty parliament
        if year < this_year and len(rows) < 100 and not args.limit:
            log.error("cdep listing %d parsed only %d rows — markup changed? aborting", year, len(rows))
            return 1
        log.info("cdep %d: %d initiatives", year, len(rows))
        for r in rows:
            listing_rows[r["cdep_code"]] = r
    if args.limit:
        listing_rows = dict(list(listing_rows.items())[: args.limit])

    # 2) cdep fișe — new/changed rows only (daily); everything missing obiect (backfill)
    fisa_by_code: dict[str, dict] = {}
    for code, r in listing_rows.items():
        prev = existing_by_code.get(code)
        changed = not prev or prev.get("stage_raw") != r["stage_raw"] \
            or str(prev.get("stage_date") or "") != str(r["stage_date"] or "")
        need = changed or not prev.get("obiect") or (args.backfill and not prev)
        if prev and not need:
            continue
        key = f"cdep:{r['cdep_idp']}"
        hit, payload = ckpt.get(key)
        if not hit:
            num, yr = code[3:].split("/")
            payload = scraper.cdep_fisa(r["cdep_idp"], num, yr)
            if payload is not None:  # failures are retried on resume, not checkpointed
                ckpt.put(key, payload)
        if payload:
            fisa_by_code[code] = payload
    log.info("cdep fișe parsed: %d", len(fisa_by_code))

    # 3) senat registry — refresh non-final known codes + probe past the max
    senat_by_code: dict[str, dict] = {}
    known_l: dict[int, int] = {}
    refresh: set[str] = set()
    for r in existing:
        sc = r.get("senat_code")
        if not sc:
            continue
        n, y = int(sc[1:].split("/")[0]), int(sc.split("/")[1])
        known_l[y] = max(known_l.get(y, 0), n)
        if r.get("stage") not in FINAL_STAGES:
            refresh.add(sc)
    for f in fisa_by_code.values():  # cross-refs discovered this run
        if f.get("senat_code"):
            refresh.add(f["senat_code"])

    def senat_get(code: str) -> dict | None:
        key = f"senat:{code}"
        hit, payload = ckpt.get(key)
        if not hit:
            payload = scraper.senat_fisa(code)
            if payload is None:
                return None  # fetch failure — do not checkpoint, retry next run
            ckpt.put(key, payload)
        return payload

    probe_years = years if args.backfill else [this_year]
    for year in probe_years:
        n, misses = (1 if args.backfill else known_l.get(year, 0) + 1), 0
        if args.limit and not args.backfill:
            continue
        while misses < PROBE_MISSES:
            if args.limit and len(senat_by_code) >= args.limit:
                break
            code = f"L{n}/{year}"
            data = senat_get(code)
            if data is None:
                break  # network trouble — stop probing, keep what we have
            if not data:
                misses += 1
            else:
                misses = 0
                senat_by_code[code] = data
            n += 1
        log.info("senat %d: probed up to L%d, %d found", year,
                 n - 1, sum(1 for c in senat_by_code if c.endswith(str(year))))
    for code in sorted(refresh - set(senat_by_code)):
        if args.limit and len(senat_by_code) >= args.limit:
            break
        data = senat_get(code)
        if data:
            senat_by_code[code] = data

    # 4) merge legs → rows
    by_key: dict[str, dict] = {}
    claimed_senat: set[str] = set()
    for code, listing in listing_rows.items():
        fisa = fisa_by_code.get(code)
        prev = existing_by_code.get(code) or {}
        senat_code = (fisa or {}).get("senat_code") or prev.get("senat_code")
        senat = senat_by_code.get(senat_code) if senat_code else None
        if senat_code:
            claimed_senat.add(senat_code)
        row = build_row(listing, fisa, senat)
        if not row["senat_code"]:
            row["senat_code"] = senat_code
        by_key[row["senat_code"] or row["cdep_code"]] = row
    for code, senat in senat_by_code.items():
        if code in claimed_senat:
            continue
        cdep_code = senat.get("cdep_code")
        listing = listing_rows.get(cdep_code) if cdep_code else None
        fisa = fisa_by_code.get(cdep_code) if cdep_code else None
        if listing:  # senate journey knew the PLx before the fișă linked back
            by_key.pop(cdep_code, None)
        by_key[code] = build_row(listing, fisa, senat)

    rows = list(by_key.values())
    if args.dry_run:
        for r in rows[:30]:
            log.info("%-14s %-12s %-18s reg=%s com=%s | %s",
                     r.get("cdep_code") or "", r.get("senat_code") or "",
                     r.get("stage") or "?", r.get("registered_date"),
                     r.get("committee_since"), (r.get("title") or "")[:60])
        log.info("dry run: %d rows built", len(rows))
        return 0

    # 5) write — keep untouched DB fields (obiect/senat side) when this run
    #    didn't refetch them; sanity floor before any bulk write
    floor = 500 if args.backfill else 1
    if len(rows) < floor:
        log.error("only %d rows built (floor %d) — refusing to write", len(rows), floor)
        return 1

    laws = {l["code"]: l["id"] for l in fetch_all(lambda: db.table("laws").select("id,code"))}
    inserted = updated = unchanged = 0
    for r in rows:
        r["law_id"] = laws.get(r["senat_code"] or "") or laws.get(r["cdep_code"] or "")
        prev = existing_by_code.get(r["senat_code"] or "") or existing_by_code.get(r["cdep_code"] or "")
        payload = {k: v for k, v in r.items() if v is not None or k in ("stage_date", "committee_since")}
        # registration never moves later — a run that saw only the cdep leg must
        # not overwrite the earlier senat-registry date (and vice versa)
        if prev and prev.get("registered_date") and (
                not r.get("registered_date") or prev["registered_date"] < r["registered_date"]):
            payload["registered_date"] = prev["registered_date"]
        if prev and prev.get("committee_since") and payload.get("committee_since") is None \
                and r.get("stage") not in FINAL_STAGES:
            payload.pop("committee_since", None)
        if prev:
            diff = {k: v for k, v in payload.items()
                    if k != "scraped_at" and str(prev.get(k, object())) != str(v)}
            if not diff and prev.get("obiect"):
                unchanged += 1
                continue
            db.table("initiatives").update(payload).eq("id", prev["id"]).execute()
            updated += 1
        else:
            db.table("initiatives").insert(payload).execute()
            inserted += 1
    unmapped = sum(1 for r in rows if r.get("stage") is None and r.get("stage_raw"))
    log.info("done: %d inserted, %d updated, %d unchanged, %d unmapped stage_raw",
             inserted, updated, unchanged, unmapped)
    return 0


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="VotRO — parliamentary initiatives scraper")
    ap.add_argument("--backfill", action="store_true", help="full sweep of all years, checkpointed")
    ap.add_argument("--checkpoint", default="initiative_backfill.tsv")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, help="cap cdep fișă/senat fetches (debug)")
    ap.add_argument("--senat-code", help="debug: parse one senat fișă and print")
    ap.add_argument("--cdep-idp", type=int, help="debug: parse one cdep fișă and print")
    args = ap.parse_args()

    if args.senat_code:
        print(json.dumps(InitiativeScraper().senat_fisa(args.senat_code), indent=2, ensure_ascii=False))
        return
    if args.cdep_idp:
        print(json.dumps(InitiativeScraper().cdep_fisa(args.cdep_idp, r"\d+", r"\d{4}"), indent=2, ensure_ascii=False))
        return
    sys.exit(run(args))


if __name__ == "__main__":
    main()
