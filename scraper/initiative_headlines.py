"""Short headlines for /initiative rows, in scrape_meta.initiative_headlines.

Initiatives matched to a law (initiatives.law_id) reuse laws.headline on the page;
this covers the rest, plus linked laws that have no headline yet. Same prompt and
style guard as tacit_headlines.py (interest_scorer's mechanism-not-outcome headline,
rule-breakers get none), fed with the official title and the registry «obiect».
Stored as one JSON row {initiative_id: headline}, so no migration is needed. Only
rows without a headline are sent.

Env: SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY.
Usage: python initiative_headlines.py [--redo] [--limit N]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

import anthropic
import requests
from dotenv import load_dotenv

from interest_scorer import _RETRY_MODEL, haiku_scores, slop_headline
from paging import rest_all

load_dotenv(override=True)
URL, KEY = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
META_KEY = "initiative_headlines"


def _get(table: str, **params: str) -> list[dict]:
    r = requests.get(f"{URL}/rest/v1/{table}", headers=H, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--redo", action="store_true", help="regenerate every headline")
    ap.add_argument("--limit", type=int, default=2000)
    args = ap.parse_args()
    if not (URL and KEY and os.environ.get("ANTHROPIC_API_KEY")):
        sys.exit("SUPABASE_URL, SUPABASE_KEY and ANTHROPIC_API_KEY must be set")

    rows = rest_all(_get, "initiatives", select="id,title,obiect,law_category,laws(headline)")
    meta = _get("scrape_meta", select="value", key=f"eq.{META_KEY}")
    known: dict[str, str] = {} if args.redo else (json.loads(meta[0]["value"]) if meta and meta[0].get("value") else {})
    todo = [
        {"code": r["id"], "title": (r.get("title") or "")[:400], "summary": r.get("obiect"), "law_category": r.get("law_category")}
        for r in rows
        if r.get("title") and not (r.get("laws") or {}).get("headline") and r["id"] not in known
    ][: args.limit]
    print(f"{len(rows)} initiatives, {len(todo)} need a headline")
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
        print(f"  {i + len(batch)}/{len(todo)}: {got} headlines")

    now = dt.datetime.now(dt.timezone.utc).isoformat()
    r = requests.post(f"{URL}/rest/v1/scrape_meta", params={"on_conflict": "key"},
                      headers={**H, "Prefer": "resolution=merge-duplicates"},
                      json=[{"key": META_KEY, "value": json.dumps(known, ensure_ascii=False), "updated_at": now}],
                      timeout=60)
    r.raise_for_status()
    print(f"{META_KEY}: {got} new, {len(known)} total")


if __name__ == "__main__":
    main()
