"""Bills with a running constitutional (tacit-adoption) term — art. 75 alin. 2.

Source: cdep.ro "Verificare termene legale" — the official list of bills
registered at the Camera as first chamber whose 45/60-day terms are running,
including the exact deadline date:

    /ords/pls/proiecte/upl_pck2015.termene_camera1

The list is authoritative and complete, so we replace our table's deputies
rows wholesale on every run (bills leave the list when voted or tacitly
adopted). Senate-first bills have no equivalent public list — chamber stays
'deputies' for now.

cdep.ro drops non-EU IPs — run on the EU VPS (part of run_daily.sh).

Usage:
    python tacit_scraper.py [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime
import logging
import os
import re
import sys

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("tacit")

UA = {"User-Agent": "Mozilla/5.0 (compatible; VotRO/1.0; +https://vot-romania.vercel.app)"}
BASE = "https://www.cdep.ro"
LIST_URL = BASE + "/ords/pls/proiecte/upl_pck2015.termene_camera1"


def parse_bills(html: str) -> list[dict]:
    bills = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
        if "idp=" not in row:
            continue
        link = re.search(r'href="([^"]*upl_pck2015\.proiect\?[^"]*idp=\d+[^"]*)"', row)
        cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip()
                 for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        # [nr, "186/16.03.2026", title, committee, "45 prelungit la 60 zile",
        #  "04.09.2026", "la comisii (Termen raport: ...)"] — the deadline is
        # the last cell that is exactly a date, not the last cell.
        if len(cells) < 6 or not link:
            continue
        reg = re.match(r"(\d+)\s*/\s*(\d{2})\.(\d{2})\.(\d{4})", cells[1])
        deadline = next(
            (m for c in reversed(cells) if (m := re.fullmatch(r"(\d{2})\.(\d{2})\.(\d{4})", c))),
            None,
        )
        if not reg or not deadline:
            continue
        bills.append({
            "code": f"BP{reg.group(1)}/{reg.group(4)}",
            "title": cells[2][:500],
            "chamber": "deputies",
            "committee": cells[3][:200] or None,
            "term_days": cells[4][:60] or None,
            "tacit_deadline": datetime.date(
                int(deadline.group(3)), int(deadline.group(2)), int(deadline.group(1))
            ).isoformat(),
            "source_url": BASE + link.group(1).replace("&amp;", "&") if link.group(1).startswith("/") else link.group(1),
        })
    return bills


def find_pdf(fisa_html: str) -> str | None:
    """Bill-text PDF on a fișa page. cdep names files by role: pl* = the
    proposal itself, em* = expunerea de motive — prefer the actual text."""
    hrefs = [h.replace("&amp;", "&") for h in re.findall(r'href="([^"]+\.pdf)"', fisa_html, re.I)]
    if not hrefs:
        return None
    best = next((h for h in hrefs if re.search(r"/pl\d+[^/]*\.pdf$", h, re.I)), None) \
        or next((h for h in hrefs if re.search(r"/em\d+[^/]*\.pdf$", h, re.I)), None) \
        or hrefs[0]
    return BASE + best if best.startswith("/") else best


def attach_pdfs(bills: list[dict], session: requests.Session) -> None:
    """Fetch each bill's fișa and record the PDF link. Best-effort: a missing
    or slow fișa never blocks the deadline list itself."""
    import time

    for b in bills:
        b["pdf_url"] = None
        try:
            r = session.get(b["source_url"], headers=UA, timeout=20)
            if r.ok:
                b["pdf_url"] = find_pdf(r.text)
        except requests.RequestException:
            pass
        time.sleep(0.4)  # be polite — this hits ~40 fișa pages per run


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="VotRO — tacit-adoption deadline scraper")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    session = requests.Session()
    r = session.get(LIST_URL, headers=UA, timeout=30)
    r.raise_for_status()
    bills = parse_bills(r.text)
    log.info("parsed %d bills with running terms", len(bills))
    attach_pdfs(bills, session)
    log.info("pdfs found: %d/%d", sum(1 for b in bills if b.get("pdf_url")), len(bills))
    if args.dry_run:
        for b in bills[:10]:
            log.info("%s  %s  %s  pdf=%s", b["code"], b["tacit_deadline"], b["title"][:70], b.get("pdf_url"))
        return

    from supabase import create_client

    db = create_client(url, key)
    # The source list is complete → replace our deputies rows wholesale.
    db.table("pending_bills").delete().eq("chamber", "deputies").execute()
    if bills:
        try:
            db.table("pending_bills").insert(bills).execute()
        except Exception as e:  # noqa: BLE001 — pdf_url column not migrated yet (035)
            if "pdf_url" not in str(e):
                raise
            log.warning("pdf_url column missing (run migration 035) — inserting without PDFs")
            db.table("pending_bills").insert(
                [{k: v for k, v in b.items() if k != "pdf_url"} for b in bills]
            ).execute()
    log.info("pending_bills refreshed: %d rows", len(bills))


if __name__ == "__main__":
    main()
