"""Short headlines for tacit-term bills (homepage + /tacite), in scrape_meta.tacit_headlines.

pending_bills has a 2-3 sentence AI summary (pending_bills_scorer.py) but no short
title, so the homepage list showed whole paragraphs. This reuses interest_scorer's
headline prompt and style guard (no colon, no em dash, no «Schimbări…» opener;
a rule-breaker gets no headline). Sonnet, not Haiku: the list is a handful of bills
and Haiku broke grammar and overstated summaries on the first run (6 Nov 2026) and stores {code: headline}
as one JSON row, so no migration is needed. Only bills without a headline yet are
sent; the map keeps headlines of bills that already left the list.

Env: SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY. Usage: python tacit_headlines.py [--redo]
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys

import anthropic
import requests
from dotenv import load_dotenv

from interest_scorer import _RETRY_MODEL, haiku_scores, slop_headline

load_dotenv(override=True)
URL, KEY = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def main() -> None:
    if not (URL and KEY and os.environ.get("ANTHROPIC_API_KEY")):
        sys.exit("SUPABASE_URL, SUPABASE_KEY and ANTHROPIC_API_KEY must be set")
    today = dt.date.today().isoformat()
    bills = requests.get(f"{URL}/rest/v1/pending_bills", headers=H, timeout=60, params={
        "select": "code,title,summary", "tacit_deadline": f"gte.{today}", "order": "tacit_deadline",
    }).json()
    row = requests.get(f"{URL}/rest/v1/scrape_meta", headers=H, timeout=60,
                       params={"select": "value", "key": "eq.tacit_headlines"}).json()
    known: dict[str, str] = {} if "--redo" in sys.argv else (json.loads(row[0]["value"]) if row and row[0].get("value") else {})
    todo = [{"code": b["code"], "title": b.get("title") or b["code"], "summary": b.get("summary"), "law_category": None}
            for b in bills if b["code"] not in known]
    print(f"{len(bills)} upcoming tacit bills, {len(todo)} without a headline")
    if not todo:
        return
    client = anthropic.Anthropic()
    got = 0
    for i in range(0, len(todo), 20):
        batch = todo[i:i + 20]
        scores = haiku_scores(client, batch, _RETRY_MODEL)
        for b in batch:
            h = (scores.get(b["code"]) or {}).get("headline")
            if h and not slop_headline(h):
                known[b["code"]] = h.strip()
                got += 1
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    r = requests.post(f"{URL}/rest/v1/scrape_meta", params={"on_conflict": "key"},
                      headers={**H, "Prefer": "resolution=merge-duplicates"},
                      json=[{"key": "tacit_headlines", "value": json.dumps(known, ensure_ascii=False), "updated_at": now}],
                      timeout=60)
    r.raise_for_status()
    print(f"tacit_headlines: {got} new, {len(known)} total")


if __name__ == "__main__":
    main()
