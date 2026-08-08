"""Structured two-part law summaries via Claude Haiku 4.5 (paid, no quota headaches).

Same job as gemini_summarizer.py (reads the bill-text + expunere de motive PDFs
natively, returns the ce_face / motivare_initiatori JSON), but through the
Anthropic API. Reuses that module's fetchers, prompt, and Store so the two
providers stay identical.

Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY.
Usage:
    python haiku_summarizer.py [--limit N] [--redo CODE] [--dry-run]
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import anthropic
from dotenv import load_dotenv

from gemini_summarizer import (Store, em_url_for, fetch_pdf, fg_url_for,
                               haiku_summary, summary_source_for)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("haiku-summary")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Structured two-part law summaries via Claude Haiku")
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
        title = law.get("title") or law["code"]
        em, fg = em_url_for(law["code"]), fg_url_for(law["code"])
        em_pdf, fg_pdf = fetch_pdf(em), fetch_pdf(fg)
        source = summary_source_for(fg_pdf, em_pdf)
        try:
            res = haiku_summary(client, fg_pdf, em_pdf, title)
        except anthropic.APIStatusError as e:
            log.warning("%s: API error %s — skipping this run", law["code"], e.status_code)
            continue
        done += 1
        if res:
            ok += 1
        log.info("%s [%s]: %s", law["code"], source,
                 (res["ce_face"] if res else "INDISPONIBIL")[:90])
        if not args.dry_run:
            store.save(law["id"], res, em if em_pdf else None, fg if fg_pdf else None, source)
        time.sleep(0.3)

    log.info("done: %d processed, %d summarized%s", done, ok, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
