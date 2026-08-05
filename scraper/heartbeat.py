"""Write the scraper heartbeat: scrape_meta.last_scrape_at (+ last exit code).

Runs as the final step of run_daily.sh so the site footer can distinguish
"parliament simply hasn't voted lately" from "the pipeline is broken".

On rc != 0 it also emails IG_PREVIEW_EMAIL (via Resend) — at most once per
day — because nobody reads the VPS logs: a silent source-HTML change would
otherwise go unnoticed until the footer warning is spotted days later.

Usage: python heartbeat.py <rc>
"""
from __future__ import annotations

import datetime
import os
import pathlib
import sys

import requests
from dotenv import load_dotenv


def alert(rc: str) -> None:
    key = os.environ.get("RESEND_API_KEY")
    to = os.environ.get("IG_PREVIEW_EMAIL")
    if not key or not to:
        return
    marker = pathlib.Path(f"/tmp/.scrapefail-{datetime.date.today():%Y%m%d}")
    if marker.exists():  # one alert per day, not one per failing run
        return
    log = f"/var/log/votro/scrape-{datetime.date.today():%Y%m%d}.log"
    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "from": os.environ.get("NEWSLETTER_FROM", "LaButoane <alerte@la-butoane.ro>"),
            "to": [to],
            "subject": f"⚠ scrape FAILED (rc={rc})",
            "html": (f"<p>Rulajul zilnic a ieșit cu rc={rc}.</p>"
                     f"<p><code>ssh root@46.62.222.45 'grep -iE \"FAIL|FATAL|error\" {log} | tail'</code></p>"),
        },
        timeout=30,
    )
    if r.ok:
        marker.touch()
        print("failure alert emailed")
    else:
        print(f"failure alert NOT sent ({r.status_code})")


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
    if rc != "0":
        try:
            alert(rc)
        except requests.RequestException as e:  # alerting must never mask the heartbeat
            print(f"failure alert error: {e}")


if __name__ == "__main__":
    main()
