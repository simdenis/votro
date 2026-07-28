"""AI law categorization via Gemini for laws the regex classifier missed.

The title-regex classifier (camera_scraper._classify_law / migration 003)
leaves ~half the laws uncategorized — titles like "pentru modificarea art.X
din Legea nr.Y" say nothing about the domain. The AI summary (laws.summary)
does. One Gemini call per law (title + summary → one category from the fixed
list); the free tier covers the whole backlog.

Only fills law_category IS NULL — never overwrites regex or manual categories.
Re-runnable; laws where the model can't decide stay NULL.

Env: GEMINI_API_KEY (free from aistudio.google.com), SUPABASE_URL, SUPABASE_KEY.
Usage:
    python categorize_laws.py [--limit N] [--dry-run]
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("categorize")

MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

CATEGORIES = [
    "Sănătate", "Educație", "Justiție", "Social", "Infrastructură",
    "Transport", "Agricultură", "Mediu", "Energie", "Apărare",
    "Economie", "Tehnologie", "Administrație",
]

PROMPT = f"""Categorizează această lege românească într-una din categoriile:
{", ".join(CATEGORIES)}

Răspunde DOAR cu numele categoriei, nimic altceva. Dacă niciuna nu se potrivește clar, răspunde NICIUNA.

Titlu: {{title}}
Rezumat: {{summary}}"""


class RateLimited(Exception):
    pass


def categorize(api_key: str, title: str, summary: str) -> str | None:
    body = {
        "contents": [{"parts": [{"text": PROMPT.format(title=title, summary=summary or "—")}]}],
        # thinkingBudget: 0 — 2.5 models think by default; the reasoning eats the
        # tiny output budget and returns an empty part. Trivial task, skip it.
        "generationConfig": {"temperature": 0, "maxOutputTokens": 20,
                             "thinkingConfig": {"thinkingBudget": 0}},
    }
    # On a 429 (per-minute quota) wait for the window and retry; give up only if
    # it's persistent (daily quota exhausted).
    for wait_try in range(4):
        r = requests.post(GEMINI_URL, params={"key": api_key}, json=body, timeout=60)
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
    return text if text in CATEGORIES else None


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="AI law categorization via Gemini")
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        sys.exit("ERROR: GEMINI_API_KEY not set")
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and key):
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    from supabase import create_client

    db = create_client(url, key)
    laws = (
        db.table("laws")
        .select("id, code, title, summary")
        .is_("law_category", "null")
        .limit(args.limit)
        .execute()
        .data
    )
    log.info("%d law(s) without category", len(laws))

    done = 0
    for law in laws:
        try:
            cat = categorize(api_key, law["title"] or "", law["summary"] or "")
        except RateLimited as e:
            log.warning("%s: rate limited — stopping this run (%s)", law["code"], e)
            break
        log.info("%s: %s  (%s)", law["code"], cat or "NICIUNA", (law["title"] or "")[:60])
        if cat and not args.dry_run:
            db.table("laws").update({"law_category": cat}).eq("id", law["id"]).execute()
        done += 1
        time.sleep(0.2)

    log.info("done: %d processed%s", done, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
