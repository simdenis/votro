"""Homepage «Cine lipsește cel mai mult»: precompute the 15 lowest-presence MPs
per chamber into scrape_meta.absence_top.

The live query sorts the whole senator_stats / deputy_stats view by presence,
which runs 1–4 s and hits the anon statement timeout often enough that a cached
homepage showed an empty Cameră tab (6 Nov 2026). This runs daily with the
service key after the scrape; the page reads one row and falls back to the live
query only if the row is missing.

Same guards as the live query: active, not in Government (gov_role), no
context_note. Env: SUPABASE_URL, SUPABASE_KEY. Usage: python absence_top.py
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv(override=True)
URL, KEY = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
COLS = "politician_id,name,first_name,party_abbr,party_color,presence_pct,chamber_votes,context_note"


def top(view: str) -> list[dict]:
    r = requests.get(f"{URL}/rest/v1/{view}", headers=H, timeout=120, params={
        "select": COLS, "active": "eq.true", "gov_role": "is.null", "context_note": "is.null",
        "order": "presence_pct.asc", "limit": "15",
    })
    r.raise_for_status()
    return r.json()


def main() -> None:
    if not (URL and KEY):
        sys.exit("SUPABASE_URL and SUPABASE_KEY must be set")
    data = {"senators": top("senator_stats"), "deputies": top("deputy_stats")}
    if not data["senators"] or not data["deputies"]:
        sys.exit("ERROR: an empty chamber list; keeping the previous row")
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    data["generated_at"] = now
    r = requests.post(f"{URL}/rest/v1/scrape_meta", params={"on_conflict": "key"},
                      headers={**H, "Prefer": "resolution=merge-duplicates"},
                      json=[{"key": "absence_top", "value": json.dumps(data, ensure_ascii=False), "updated_at": now}],
                      timeout=60)
    r.raise_for_status()
    print(f"absence_top written: {len(data['senators'])} senators, {len(data['deputies'])} deputies")


if __name__ == "__main__":
    main()
