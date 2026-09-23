"""Re-derive the outcome of every Senate vote from the senat.ro fișă.

The vote-detail page has no result and "for > against" is not the rule
(adoption needs a majority of those present, or of all senators for organic
laws), so 21 final votes sat in the DB as adoptat while the fișă said
"respins de Senat". One-off repair + re-check after the scraper fix; safe to
re-run (only rows whose outcome differs are written).

Usage:
    python backfill_senate_outcomes.py [--dry-run] [--since YYYY-MM-DD]
"""
from __future__ import annotations

import argparse
import datetime
import os
import sys

import requests
from dotenv import load_dotenv

from paging import rest_all
from senat_scraper import SenatScraper, VoteTotals, fisa_outcome, tally_outcome


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--since", default="2024-12-01", help="earliest vote_date (default: this legislature)")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_KEY must be set")
    h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(table: str, **params: str) -> list[dict]:
        r = requests.get(f"{url}/rest/v1/{table}", params=params, headers=h, timeout=30)
        r.raise_for_status()
        return r.json()

    votes = rest_all(get, "votes", order="vote_date",
                     select="id,vote_date,vote_type,for_count,against_count,abstention_count,present_count,outcome,laws(code)",
                     chamber="eq.senate", vote_date=f"gte.{args.since}")
    votes = [v for v in votes if (v.get("laws") or {}).get("code") and v["vote_date"]]
    print(f"{len(votes)} senate votes since {args.since}")

    sc = SenatScraper(url, key, delay_min=0.3, delay_max=0.6)
    changed: list[tuple[dict, str, str]] = []
    no_fisa = 0
    for i, v in enumerate(votes, 1):
        t = VoteTotals(present=v["present_count"] or 0, for_=v["for_count"] or 0,
                       against=v["against_count"] or 0, abstentions=v["abstention_count"] or 0)
        fallback = tally_outcome(v["vote_type"] or "", t)
        if fallback is None:
            continue
        code = v["laws"]["code"]
        verdict = fisa_outcome(sc._fisa(code), datetime.date.fromisoformat(v["vote_date"]),
                               t.for_, t.against, t.abstentions)
        if verdict is None:
            no_fisa += 1
            verdict = fallback if "final" in (v["vote_type"] or "") else v["outcome"]
        if verdict != v["outcome"]:
            changed.append((v, v["outcome"], verdict))
        if i % 100 == 0:
            print(f"  …{i}/{len(votes)} ({len(sc._fisa_html)} fișe fetched)", flush=True)

    print(f"\n{len(changed)} outcomes differ ({no_fisa} votes had no fișă verdict → tally rule)")
    for v, old, new in changed:
        print(f"  {v['vote_date']} {v['laws']['code']:<12} {v['vote_type'] or '':<22} "
              f"{v['for_count']}/{v['against_count']}/{v['abstention_count']} p={v['present_count']}  {old} → {new}")
    if args.dry_run or not changed:
        return
    for v, _, new in changed:
        r = requests.patch(f"{url}/rest/v1/votes", params={"id": f"eq.{v['id']}"},
                           headers={**h, "Content-Type": "application/json"}, json={"outcome": new}, timeout=30)
        r.raise_for_status()
    print(f"updated {len(changed)} rows")


if __name__ == "__main__":
    main()
