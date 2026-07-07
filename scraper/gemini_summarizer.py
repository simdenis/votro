"""Plain-language law summaries from the expunere de motive PDF, via Gemini.

The extractive summarizer produced nothing — senat.ro's PDFs have garbled OCR
text layers. Gemini reads the PDF natively (multimodal), so it sidesteps that,
and writes a short summary a regular citizen can understand (validated 2026-07:
faithful to source, no hallucination, plain language). Every summary is flagged
`summary_is_ai=true` and the official PDF stays linked via `em_url`.

Incremental & resumable: only processes laws with no summary that we haven't
checked yet, stamps `summary_checked_at` so INDISPONIBIL/failed PDFs aren't
retried forever, and stops cleanly on a 429 (free-tier rate limit) so the next
run picks up where it left off.

Env: GEMINI_API_KEY (free from aistudio.google.com), SUPABASE_URL, SUPABASE_KEY.
Usage:
    python gemini_summarizer.py [--limit N] [--redo CODE] [--dry-run]
"""
from __future__ import annotations

import argparse
import base64
import datetime
import logging
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gemini-summary")

CODE_RE = re.compile(r"^L(\d+)/(\d{4})$")
MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
UA = {"User-Agent": "Mozilla/5.0"}
_DELAY = 6.5  # stay under the ~10 requests/min free-tier limit

PROMPT = (
    "Documentul atașat este expunerea de motive a unui proiect de lege românesc. "
    "Explică pe scurt, pentru un cetățean obișnuit fără studii juridice, CE SCHIMBĂ "
    "acest proiect și de ce contează pentru oameni. Reguli:\n"
    "- limbaj simplu, de zi cu zi; evită jargonul juridic\n"
    "- NU cita numere de articole, directive sau legi (ex. „art. 281”, „Directiva "
    "2006/112/CE”); spune în cuvinte ce înseamnă\n"
    "- 1-2 fraze scurte, maximum ~50 de cuvinte\n"
    "- folosește STRICT informația din document; nu inventa, nu adăuga opinii\n"
    "Dacă documentul e ilizibil sau nu e o expunere de motive, răspunde exact: "
    "INDISPONIBIL. Răspunde doar cu explicația, fără preambul."
)


def em_url_for(code: str) -> str | None:
    m = CODE_RE.match(code.strip())
    if not m:
        return None
    num, year = int(m.group(1)), int(m.group(2))
    return f"https://www.senat.ro/legis/PDF/{year}/{year % 100:02d}L{num:03d}EM.PDF"


class RateLimited(Exception):
    pass


def gemini_summary(api_key: str, pdf_bytes: bytes) -> str | None:
    body = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": "application/pdf",
                             "data": base64.standard_b64encode(pdf_bytes).decode()}},
            {"text": PROMPT},
        ]}],
        # thinkingBudget: 0 — 2.5 models think by default; the reasoning eats the
        # output budget and truncates the summary. Simple task, skip it.
        "generationConfig": {"temperature": 0, "maxOutputTokens": 500,
                             "thinkingConfig": {"thinkingBudget": 0}},
    }
    # On a 429 (per-minute quota), wait for the window to reset and retry a few
    # times; only give up if it's persistent (daily quota exhausted).
    for wait_try in range(4):
        r = requests.post(GEMINI_URL, params={"key": api_key}, json=body, timeout=120)
        if r.status_code != 429:
            break
        if wait_try == 3:
            raise RateLimited(r.text[:200])
        log.info("429 — waiting 60s for the rate-limit window (try %d)", wait_try + 1)
        time.sleep(60)
    if not r.ok:
        log.warning("gemini error %s: %s", r.status_code, r.text[:150])
        return None
    try:
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        return None
    return None if text.upper().startswith("INDISPONIBIL") else text or None


class Store:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def laws_to_process(self, limit: int, only: str | None) -> list[dict]:
        params = {"select": "id,code", "order": "code.desc", "limit": str(limit)}
        if only:
            params = {"select": "id,code", "code": f"eq.{only}", "limit": "1"}
        else:
            params["summary"] = "is.null"
            params["summary_checked_at"] = "is.null"
            params["code"] = "like.L*"
        r = requests.get(f"{self.url}/rest/v1/laws", params=params, headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()

    def save(self, law_id: str, summary: str | None, em_url: str | None) -> None:
        payload: dict = {
            "summary": summary,
            "summary_is_ai": summary is not None,
            "summary_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        if em_url:
            payload["em_url"] = em_url
        r = requests.patch(f"{self.url}/rest/v1/laws", params={"id": f"eq.{law_id}"},
                          headers={**self.h, "Content-Type": "application/json"},
                          json=payload, timeout=30)
        r.raise_for_status()


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Plain-language law summaries via Gemini")
    ap.add_argument("--limit", type=int, default=500, help="max laws this run")
    ap.add_argument("--redo", metavar="CODE", help="re-summarize one law by code")
    ap.add_argument("--dry-run", action="store_true", help="print, don't write")
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not api_key:
        log.info("GEMINI_API_KEY not set — skipping (summaries stay link-only)")
        return
    if not (url and key):
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    store = Store(url, key)
    laws = store.laws_to_process(args.limit, args.redo)
    log.info("%d law(s) to process", len(laws))
    done = ok = 0
    for law in laws:
        em = em_url_for(law["code"])
        if not em:
            continue
        try:
            pdf = requests.get(em, timeout=45, headers=UA)
        except requests.RequestException as e:
            log.warning("%s: PDF fetch failed: %s", law["code"], e)
            continue
        # No EM PDF for this bill → stamp checked so we don't retry, keep link-only.
        if not pdf.ok or "pdf" not in pdf.headers.get("content-type", "").lower() or len(pdf.content) < 1000:
            if not args.dry_run:
                store.save(law["id"], None, None)
            continue
        try:
            summary = gemini_summary(api_key, pdf.content)
        except RateLimited as e:
            log.warning("rate limited — stopping cleanly, next run resumes (%s)", e)
            break
        done += 1
        if summary:
            ok += 1
            log.info("%s: %s", law["code"], summary[:90])
        else:
            log.info("%s: INDISPONIBIL", law["code"])
        if not args.dry_run:
            store.save(law["id"], summary, em)
        time.sleep(_DELAY)

    log.info("done: %d processed, %d summarized%s", done, ok, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
