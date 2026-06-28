"""
VotRO — law summary extractor (no AI, free)

For each law without a summary yet:
  1. Derive the senat.ro "expunere de motive" PDF URL from the law code
       L34/2026  → https://www.senat.ro/legis/PDF/2026/26L034EM.PDF
  2. Download it, extract text (pypdf), grab the "Motivul emiterii" paragraph
  3. Quality gate: store the text as `summary` ONLY if it's clean enough
     (these PDFs sometimes have garbled OCR text layers); always store `em_url`
     so the frontend can link the full PDF, and stamp `summary_checked_at` so we
     never reprocess the same law.

Writes to: laws.summary, laws.em_url, laws.summary_checked_at
"""

from __future__ import annotations

import argparse
import datetime
import io
import logging
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("votro.summary")

CODE_RE = re.compile(r"^L(\d+)/(\d{4})$")
SECTION_RE = re.compile(r"^\s*\d+[.)]\s")          # "2. ", "3) " — section headers
MOTIV_RE = re.compile(r"motivul\s+emiterii", re.IGNORECASE)

MAX_SUMMARY_CHARS = 600
MIN_SUMMARY_CHARS = 90
GARBLE_THRESHOLD = 0.12   # >12% suspect words → reject as garbled


def em_url_for(code: str) -> str | None:
    """L34/2026 → https://www.senat.ro/legis/PDF/2026/26L034EM.PDF"""
    m = CODE_RE.match(code.strip())
    if not m:
        return None
    num, year = int(m.group(1)), int(m.group(2))
    return f"https://www.senat.ro/legis/PDF/{year}/{year % 100:02d}L{num:03d}EM.PDF"


def _extract_text(pdf_bytes: bytes, max_pages: int = 3) -> str:
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    parts = [p.extract_text() or "" for p in reader.pages[:max_pages]]
    text = "\n".join(parts)
    # collapse runs of spaces/tabs but keep line breaks (needed for section detection)
    return re.sub(r"[ \t]+", " ", text)


def _scop_paragraph(text: str) -> str | None:
    """Pull the rationale paragraph that follows the 'Motivul emiterii' header."""
    m = MOTIV_RE.search(text)
    if not m:
        return None
    rest = text[m.end():]
    lines = [ln.strip() for ln in rest.splitlines()]
    # Skip the remainder of the header line ('... actului normativ'), then collect
    # body lines until the next numbered section or until we have enough text.
    body: list[str] = []
    started = False
    for ln in lines:
        if not ln:
            if started and body:
                break  # blank line ends the first paragraph once we've started
            continue
        if SECTION_RE.match(ln):
            if started:
                break
            continue  # still on/just past the header
        started = True
        body.append(ln)
        if sum(len(b) for b in body) >= MAX_SUMMARY_CHARS:
            break
    para = " ".join(body).strip()
    return para or None


def _is_clean(text: str) -> bool:
    """Reject OCR-garbled text: backticks/brackets in words, mid-word capitals, digit-letter mix."""
    words = re.findall(r"\S+", text)
    if not words:
        return False
    suspect = 0
    for w in words:
        core = w.strip(".,;:()\"'»«–—")
        if not core:
            continue
        if any(c in core for c in "`[]|\\^~{}"):
            suspect += 1
            continue
        # internal uppercase (e.g. tTanzitia) on a not-all-caps word
        if not core.isupper() and re.search(r"\B[A-ZĂÂÎȘȚ]", core[1:]):
            suspect += 1
            continue
        # digit glued to letters inside a word (e.g. Astf3l) — but allow pure tokens like "2023-2027"
        if re.search(r"[A-Za-zĂÂÎȘȚăâîșț]\d|\d[A-Za-zĂÂÎȘȚăâîșț]", core):
            suspect += 1
            continue
    return (suspect / len(words)) <= GARBLE_THRESHOLD


def _truncate(text: str) -> str:
    if len(text) <= MAX_SUMMARY_CHARS:
        return text
    cut = text[:MAX_SUMMARY_CHARS]
    dot = cut.rfind(". ")
    return (cut[: dot + 1] if dot > MIN_SUMMARY_CHARS else cut.rstrip() + "…")


class LawSummarizer:
    def __init__(self, url: str, key: str, delay: float = 1.0) -> None:
        self.db: Client = create_client(url, key)
        self.delay = delay
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({"User-Agent": "Mozilla/5.0 (VotRO research; siminiucdenis@gmail.com)"})
        self.stats = {"summarized": 0, "link_only": 0, "no_em": 0, "skipped": 0, "errors": 0}

    def _laws_to_process(self, only: str | None, redo: bool) -> list[dict]:
        q = self.db.table("laws").select("id, code, summary, summary_checked_at")
        if only:
            q = q.eq("code", only)
        elif not redo:
            q = q.is_("summary_checked_at", "null")
        return q.execute().data or []

    def process_one(self, law: dict) -> None:
        code = law["code"]
        url = em_url_for(code)
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if not url:
            log.info("%s: code not in L<n>/<year> form — skipping", code)
            self.db.table("laws").update({"summary_checked_at": now}).eq("id", law["id"]).execute()
            self.stats["skipped"] += 1
            return

        try:
            r = self.session.get(url, timeout=30)
            if r.status_code != 200 or "pdf" not in r.headers.get("Content-Type", "").lower():
                log.info("%s: no EM PDF (HTTP %s)", code, r.status_code)
                self.db.table("laws").update({"summary_checked_at": now}).eq("id", law["id"]).execute()
                self.stats["no_em"] += 1
                return

            text = _extract_text(r.content)
            para = _scop_paragraph(text)

            update: dict = {"em_url": url, "summary_checked_at": now}
            if para and len(para) >= MIN_SUMMARY_CHARS and _is_clean(para):
                update["summary"] = _truncate(para)
                self.stats["summarized"] += 1
                log.info("%s: summary stored (%d chars)", code, len(update["summary"]))
            else:
                reason = "no scop paragraph" if not para else ("too short" if len(para) < MIN_SUMMARY_CHARS else "garbled")
                self.stats["link_only"] += 1
                log.info("%s: link only (%s)", code, reason)

            self.db.table("laws").update(update).eq("id", law["id"]).execute()

        except Exception as exc:  # noqa: BLE001
            log.warning("%s: error — %s", code, exc)
            self.stats["errors"] += 1

    def run(self, only: str | None = None, redo: bool = False) -> None:
        laws = self._laws_to_process(only, redo)
        log.info("Found %d law(s) to process", len(laws))
        for law in laws:
            self.process_one(law)
            time.sleep(self.delay)
        print("\n" + "=" * 46)
        print("VotRO law summaries — run summary")
        for k, v in self.stats.items():
            print(f"  {k:12s}: {v}")
        print("=" * 46)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="VotRO — law summary extractor (from expunere de motive)")
    parser.add_argument("--code", help="Process a single law by code (e.g. L34/2026)")
    parser.add_argument("--redo", action="store_true", help="Reprocess all laws, ignoring summary_checked_at")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set.")
        sys.exit(1)

    LawSummarizer(url, key).run(only=args.code, redo=args.redo)


if __name__ == "__main__":
    main()
