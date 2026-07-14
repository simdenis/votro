"""Refresh analytics materialized views after the daily scrape.

party_agreement (migration 029) is a materialized view — the pairwise
self-join is too heavy for a live query, so it's precomputed and must be
refreshed once new votes land. Calls the SECURITY DEFINER RPC that runs
REFRESH MATERIALIZED VIEW with a raised statement_timeout.

Env: SUPABASE_URL, SUPABASE_KEY (service role). Usage: python refresh_matviews.py
"""
from __future__ import annotations

import os
import sys

import requests
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not (url and key):
        sys.exit("SUPABASE_URL and SUPABASE_KEY must be set")
    r = requests.post(
        f"{url}/rest/v1/rpc/refresh_party_agreement",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=200,
    )
    if not r.ok:
        sys.exit(f"refresh failed ({r.status_code}): {r.text[:200]}")
    print("party_agreement refreshed")


if __name__ == "__main__":
    main()
