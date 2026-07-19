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
    rc = 0
    # monthly_absences (036) may not exist until the migration is run — that
    # RPC 404s harmlessly; report and keep going so party_agreement still runs.
    for rpc in ("refresh_party_agreement", "refresh_monthly_absences"):
        r = requests.post(
            f"{url}/rest/v1/rpc/{rpc}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=200,
        )
        if r.ok:
            print(f"{rpc} ok")
        elif r.status_code == 404:
            print(f"{rpc} missing (migration not run yet) — skipped")
        else:
            rc = 1
            print(f"{rpc} failed ({r.status_code}): {r.text[:200]}", file=sys.stderr)
    sys.exit(rc)


if __name__ == "__main__":
    main()
