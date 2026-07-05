"""Write the scraper heartbeat: scrape_meta.last_scrape_at (+ last exit code).

Runs as the final step of run_daily.sh so the site footer can distinguish
"parliament simply hasn't voted lately" from "the pipeline is broken".

Usage: python heartbeat.py <rc>
"""
from __future__ import annotations

import datetime
import os
import sys

import requests
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    rc = sys.argv[1] if len(sys.argv) > 1 else "0"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    r = requests.post(
        f"{url}/rest/v1/scrape_meta",
        params={"on_conflict": "key"},
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "resolution=merge-duplicates",
        },
        json=[
            {"key": "last_scrape_at", "value": now, "updated_at": now},
            {"key": "last_scrape_rc", "value": rc, "updated_at": now},
        ],
        timeout=30,
    )
    r.raise_for_status()
    print(f"heartbeat written: {now} rc={rc}")


if __name__ == "__main__":
    main()
