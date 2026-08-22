#!/usr/bin/env python3
"""Zone traffic for la-butoane.ro from the Cloudflare GraphQL Analytics API.

Auth: reuses the wrangler OAuth token (~/Library/Preferences/.wrangler/config/
default.toml), or CF_API_TOKEN from the environment if set.

Usage:
  cf_traffic.py            # last 14 days, daily
  cf_traffic.py --days 30
  cf_traffic.py --hourly   # last 48h by hour, with top countries (Free plan
                           # keeps hourly data only ~3 days)

Free-plan limits: no referers, no per-path breakdown, bots included. FI traffic
is mostly our own Hetzner VPS (cache warming); RO is the human signal.
"""
import argparse
import datetime as dt
import os
import re
import sys
from pathlib import Path

import httpx

ZONE = "24959e4eb34cb889023f97a4aec43e07"
WRANGLER_CONFIG = Path.home() / "Library/Preferences/.wrangler/config/default.toml"


def token() -> str:
    if t := os.environ.get("CF_API_TOKEN"):
        return t
    m = re.search(r'^oauth_token = "([^"]+)"', WRANGLER_CONFIG.read_text(), re.M)
    if not m:
        sys.exit("no CF_API_TOKEN and no wrangler oauth_token found")
    return m.group(1)


def gql(query: str, variables: dict) -> dict:
    r = httpx.post(
        "https://api.cloudflare.com/client/v4/graphql",
        headers={"Authorization": f"Bearer {token()}"},
        json={"query": query, "variables": variables},
        timeout=30,
    )
    d = r.json()
    if d.get("errors"):
        sys.exit(f"graphql error: {d['errors']}")
    return d["data"]["viewer"]["zones"][0]


def daily(days: int) -> None:
    q = """query($zone: String!, $since: String!) { viewer { zones(filter: {zoneTag: $zone}) {
      g: httpRequests1dGroups(limit: 366, filter: {date_geq: $since}, orderBy: [date_ASC]) {
        dimensions { date }
        sum { pageViews requests countryMap { clientCountryName requests } }
        uniq { uniques } } } } }"""
    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    z = gql(q, {"zone": ZONE, "since": since})
    print(f"{'date':12}{'uniques':>8}{'pageviews':>11}{'requests':>10}  top countries")
    for g in z["g"]:
        s = g["sum"]
        top = sorted(s["countryMap"], key=lambda c: -c["requests"])[:4]
        tops = " ".join(f"{c['clientCountryName']}:{c['requests']}" for c in top)
        print(f"{g['dimensions']['date']:12}{g['uniq']['uniques']:>8}"
              f"{s['pageViews']:>11}{s['requests']:>10}  {tops}")


def hourly() -> None:
    q = """query($zone: String!, $since: Time!) { viewer { zones(filter: {zoneTag: $zone}) {
      g: httpRequests1hGroups(limit: 72, filter: {datetime_geq: $since}, orderBy: [datetime_ASC]) {
        dimensions { datetime }
        sum { pageViews requests countryMap { clientCountryName requests } }
        uniq { uniques } } } } }"""
    since = (dt.datetime.now(dt.UTC) - dt.timedelta(hours=48)).strftime("%Y-%m-%dT%H:00:00Z")
    z = gql(q, {"zone": ZONE, "since": since})
    print(f"{'hour (UTC)':18}{'uniq':>6}{'pv':>7}{'rq':>7}  top countries")
    for g in z["g"]:
        s = g["sum"]
        top = sorted(s["countryMap"], key=lambda c: -c["requests"])[:3]
        tops = " ".join(f"{c['clientCountryName']}:{c['requests']}" for c in top)
        print(f"{g['dimensions']['datetime'][5:16]:18}{g['uniq']['uniques']:>6}"
              f"{s['pageViews']:>7}{s['requests']:>7}  {tops}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--hourly", action="store_true")
    args = ap.parse_args()
    hourly() if args.hourly else daily(args.days)
