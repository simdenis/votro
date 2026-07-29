"""Backfill politician_votes.party_id — the group each vote was cast with (045).

Rows written before 045 have no party. The value is reconstructed from
politician_party_history: the segment covering the vote's date. Where no segment
covers it, fall back to the member's current party — which is what every reader
does today anyway, so the fallback can never make an existing number worse.

Done through PostgREST rather than one big SQL UPDATE: 351k rows is well past
what the SQL editor will run in a single statement, and this needs no direct
database access. Cost is one request per (politician, party segment) — a few
hundred — not one per row, because a member votes with the same group for a
whole stretch of time.

Idempotent and resumable: only ever touches rows where party_id IS NULL.

Env: SUPABASE_URL, SUPABASE_KEY. Usage: python backfill_vote_party.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("backfill-vote-party")

CHUNK = 150  # vote ids per PATCH — keeps the ?id=in.(...) URL well under limits


class Api:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.hdr = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(self, path: str, **params) -> list[dict]:
        out, offset = [], 0
        while True:
            q = dict(params, limit=1000, offset=offset)
            req = urllib.request.Request(
                f"{self.url}/rest/v1/{path}?{urllib.parse.urlencode(q)}", headers=self.hdr)
            with urllib.request.urlopen(req) as r:
                page = json.load(r)
            out.extend(page)
            if len(page) < 1000:
                return out
            offset += 1000

    def patch(self, path: str, body: dict, **params) -> int:
        """Returns the number of rows updated.

        return=minimal so a 900-row update does not ship 900 rows back; the count
        rides in the Content-Range header instead.
        """
        req = urllib.request.Request(
            f"{self.url}/rest/v1/{path}?{urllib.parse.urlencode(params)}",
            data=json.dumps(body).encode(),
            headers={**self.hdr, "Content-Type": "application/json",
                     "Prefer": "return=minimal,count=exact"},
            method="PATCH")
        with urllib.request.urlopen(req) as r:
            rng = r.headers.get("Content-Range", "")
        return int(rng.split("/")[-1]) if "/" in rng and rng.split("/")[-1].isdigit() else 0


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Backfill politician_votes.party_id")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and key):
        sys.exit("SUPABASE_URL and SUPABASE_KEY must be set")
    api = Api(url, key)

    current = {p["id"]: p["party_id"] for p in api.get("politicians", select="id,party_id")}
    segments: dict[str, list[dict]] = defaultdict(list)
    for h in api.get("politician_party_history",
                     select="politician_id,party_id,from_date,to_date", order="from_date"):
        segments[h["politician_id"]].append(h)

    # Walk every politician rather than first discovering who has unattributed
    # rows: that discovery would page through all 351k rows to build a ~470-item
    # set. A politician with nothing pending just costs one no-op PATCH.
    pending = list(current)
    log.info("%d politicians, %d history segments",
             len(pending), sum(len(v) for v in segments.values()))

    total = 0
    for i, pol_id in enumerate(sorted(pending), 1):
        segs = segments.get(pol_id, [])

        # Date-bounded segments first: these are the votes whose party differs
        # from the member's party today, i.e. the whole point of the exercise.
        #
        # Newest segment first, and every write is filtered to party_id IS NULL,
        # so an older segment can only fill what a newer one left. Without that
        # ordering an open-ended early segment (rebuild_party_history exists
        # because the state machine leaves inverted intervals) would swallow
        # every later vote.
        for seg in sorted(segs, key=lambda s: s["from_date"] or "", reverse=True):
            if not seg["party_id"]:
                continue
            # Both bounds go in one `and=(...)`: two filters on the same embedded
            # column would need duplicate query params, which a dict cannot hold.
            rng = f"(vote_date.gte.{seg['from_date']}"
            rng += f",vote_date.lte.{seg['to_date']})" if seg["to_date"] else ")"
            rows = api.get("politician_votes",
                           select="id,votes!inner(vote_date)",
                           politician_id=f"eq.{pol_id}",
                           party_id="is.null",
                           **{"votes.and": rng})
            ids = [r["id"] for r in rows]
            for j in range(0, len(ids), CHUNK):
                batch = ids[j:j + CHUNK]
                if args.dry_run:
                    total += len(batch)
                    continue
                total += api.patch("politician_votes", {"party_id": seg["party_id"]},
                                   id=f"in.({','.join(batch)})")

        # Whatever is left has no segment covering it — the current party is the
        # best available answer and matches pre-045 behaviour exactly.
        fallback = current.get(pol_id)
        if fallback:
            if args.dry_run:
                total += len(api.get("politician_votes", select="id",
                                     politician_id=f"eq.{pol_id}", party_id="is.null"))
            else:
                total += api.patch("politician_votes", {"party_id": fallback},
                                   politician_id=f"eq.{pol_id}", party_id="is.null")

        if i % 50 == 0:
            log.info("%d/%d politicians, %d votes attributed", i, len(pending), total)

    remaining = len(api.get("politician_votes", select="id", party_id="is.null"))
    log.info("done: %d votes attributed%s, %d still NULL",
             total, " (dry-run)" if args.dry_run else "", remaining)


if __name__ == "__main__":
    main()
