"""AI law categorization via Claude Haiku for laws the regex classifier missed.

The title-regex classifier (camera_scraper._classify_law / migration 003)
leaves ~half the laws uncategorized — titles like "pentru modificarea art.X
din Legea nr.Y" say nothing about the domain. The AI summary (laws.summary)
does. One Haiku call per law (title + summary → one category from the fixed
list) costs ~$0.0003; the whole backlog is under $0.10.

Only fills law_category IS NULL — never overwrites regex or manual categories.
Re-runnable; laws where the model can't decide stay NULL.

Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY.
Usage:
    python categorize_laws.py [--limit N] [--dry-run]
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import anthropic
from dotenv import load_dotenv

from paging import fetch_all

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("categorize")

MODEL = "claude-haiku-4-5"

CATEGORIES = [
    "Sănătate", "Educație", "Justiție", "Social", "Infrastructură",
    "Transport", "Agricultură", "Mediu", "Energie", "Apărare",
    # "Electoral" added in migration 050: without it, laws on elections,
    # referendums and party financing had no home and the model filed them
    # under whatever was nearest (usually Transport or Administrație).
    "Economie", "Tehnologie", "Administrație", "Electoral",
]

PROMPT = f"""Categorizează această lege românească într-una din categoriile:
{", ".join(CATEGORIES)}

Reguli:
- Răspunde DOAR cu numele exact al categoriei, nimic altceva.
- Alege categoria după DOMENIUL legii, nu după cuvinte izolate din titlu. O lege
  despre "autorizarea" a ceva sau despre "autorităţile" locale nu e Transport;
  Transport e doar despre vehicule, trafic sau transport de persoane/mărfuri.
- Legile despre alegeri, referendumuri, campanii sau finanţarea partidelor sunt Electoral.
- Dacă niciuna nu se potriveşte clar, răspunde NICIUNA. Nu ghici.

Titlu: {{title}}
Rezumat: {{summary}}"""


def categorize(client: anthropic.Anthropic, title: str, summary: str) -> str | None:
    msg = client.messages.create(
        model=MODEL,
        max_tokens=10,
        messages=[{"role": "user", "content": PROMPT.format(title=title, summary=summary or "—")}],
    )
    text = next((b.text for b in msg.content if b.type == "text"), "").strip()
    return text if text in CATEGORIES else None


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="AI law categorization via Claude Haiku")
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ERROR: ANTHROPIC_API_KEY not set")
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and key):
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    from supabase import create_client

    db = create_client(url, key)
    client = anthropic.Anthropic()
    laws = fetch_all(
        lambda: db.table("laws").select("id, code, title, summary").is_("law_category", "null"),
        total=args.limit,
    )
    log.info("%d law(s) without category", len(laws))

    done = 0
    for law in laws:
        try:
            cat = categorize(client, law["title"] or "", law["summary"] or "")
        except anthropic.APIStatusError as e:
            log.warning("%s: API error %s — stopping this run", law["code"], e.status_code)
            break
        log.info("%s: %s  (%s)", law["code"], cat or "NICIUNA", (law["title"] or "")[:60])
        if cat and not args.dry_run:
            db.table("laws").update({"law_category": cat}).eq("id", law["id"]).execute()
        done += 1
        time.sleep(0.2)

    log.info("done: %d processed%s", done, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
