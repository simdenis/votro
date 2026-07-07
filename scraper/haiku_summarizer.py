"""Plain-language law summaries via Claude Haiku 4.5 (paid, no quota headaches).

Same job as gemini_summarizer.py (reads the expunere de motive PDF natively,
writes a short plain-Romanian summary), but through the Anthropic API. Reuses
that module's em_url_for / Store / PROMPT so the two providers stay identical.

Haiku 4.5 pricing: $1 / 1M input, $5 / 1M output — the whole remaining backlog
is ~$2-3. Incremental & resumable (only laws with no summary, not yet checked).

Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY.
Usage:
    python haiku_summarizer.py [--limit N] [--redo CODE] [--dry-run]
"""
from __future__ import annotations

import argparse
import base64
import logging
import os
import sys
import time

import anthropic
import requests
from dotenv import load_dotenv

from gemini_summarizer import em_url_for, Store, PROMPT, UA

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("haiku-summary")

MODEL = "claude-haiku-4-5"


def haiku_summary(client: anthropic.Anthropic, pdf_bytes: bytes) -> str | None:
    msg = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": [
                {"type": "document", "source": {
                    "type": "base64", "media_type": "application/pdf",
                    "data": base64.standard_b64encode(pdf_bytes).decode(),
                }},
                {"type": "text", "text": PROMPT},
            ],
        }],
    )
    if msg.stop_reason == "refusal":
        return None
    text = next((b.text for b in msg.content if b.type == "text"), "").strip()
    return None if text.upper().startswith("INDISPONIBIL") else text or None


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Plain-language law summaries via Claude Haiku")
    ap.add_argument("--limit", type=int, default=500, help="max laws this run")
    ap.add_argument("--redo", metavar="CODE", help="re-summarize one law by code")
    ap.add_argument("--dry-run", action="store_true", help="print, don't write")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ERROR: ANTHROPIC_API_KEY not set")
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and key):
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    client = anthropic.Anthropic()
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
        if not pdf.ok or "pdf" not in pdf.headers.get("content-type", "").lower() or len(pdf.content) < 1000:
            if not args.dry_run:
                store.save(law["id"], None, None)
            continue
        try:
            summary = haiku_summary(client, pdf.content)
        except anthropic.APIStatusError as e:
            log.warning("%s: API error %s — skipping this run", law["code"], e.status_code)
            continue
        done += 1
        if summary:
            ok += 1
        log.info("%s: %s", law["code"], (summary or "INDISPONIBIL")[:90])
        if not args.dry_run:
            store.save(law["id"], summary, em)
        time.sleep(0.3)

    log.info("done: %d processed, %d summarized%s", done, ok, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
