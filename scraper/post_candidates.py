"""What's worth posting? Laws with recent decisive activity, ranked by interest.

Lists laws that got a FINAL vote or were promulgated in the last N days, sorted
by the Gemini interest_score (interest_scorer.py), with the vote margin and the
one-line reason. Output is a picker, not a publisher — feed the chosen id to
instagram_poster.py --law.

Usage:
    python post_candidates.py [--days 7] [--top 10] [--all]
      --all   ignore the date window (rank the whole backlog: "știai că?" posts)
"""
from __future__ import annotations

import argparse
import datetime
import os

import requests
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Rank recent laws by public interest")
    ap.add_argument("--days", type=int, default=7, help="activity window (default 7)")
    ap.add_argument("--top", type=int, default=10, help="how many to show")
    ap.add_argument("--all", action="store_true", help="ignore the date window")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_KEY must be set")
    h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(table: str, **params: str) -> list[dict]:
        r = requests.get(f"{url}/rest/v1/{table}", params=params, headers=h, timeout=30)
        r.raise_for_status()
        return r.json()

    cutoff = (datetime.date.today() - datetime.timedelta(days=args.days)).isoformat()

    # laws touched recently: a final plenary vote OR a presidential decision
    law_ids: set[str] = set()
    votes_by_law: dict[str, list[dict]] = {}
    vote_params = {"select": "law_id,chamber,vote_date,for_count,against_count,outcome",
                   "vote_type": "eq.vot final", "law_id": "not.is.null"}
    if not args.all:
        vote_params["vote_date"] = f"gte.{cutoff}"
    for v in get("votes", **vote_params):
        law_ids.add(v["law_id"])
        votes_by_law.setdefault(v["law_id"], []).append(v)

    pres_params = {"select": "id"}
    if not args.all:
        pres_params["presidential_date"] = f"gte.{cutoff}"
    else:
        pres_params["presidential_status"] = "not.is.null"
    law_ids |= {l["id"] for l in get("laws", **pres_params)}

    if not law_ids:
        print(f"No decisive activity in the last {args.days} days.")
        return

    # fetch + rank
    laws: list[dict] = []
    ids = sorted(law_ids)
    for i in range(0, len(ids), 80):  # keep the in.() filter under URL limits
        laws += get("laws", **{
            "select": "id,code,title,law_category,presidential_status,presidential_date,interest_score,interest_reason",
            "id": f"in.({','.join(ids[i:i + 80])})",
        })
    laws.sort(key=lambda l: (l["interest_score"] is None, -(l["interest_score"] or 0)))

    site = os.environ.get("SITE_URL", "https://labutoane.vercel.app").rstrip("/")
    print(f"{'SCOR':>4}  {'COD':<12} {'STATUS':<12} DE CE / TITLU")
    print("-" * 100)
    for l in laws[: args.top]:
        score = l["interest_score"] if l["interest_score"] is not None else "—"
        status = l.get("presidential_status") or ""
        margin = ""
        for v in sorted(votes_by_law.get(l["id"], []), key=lambda x: x["vote_date"] or "", reverse=True)[:1]:
            f_, a_ = v.get("for_count") or 0, v.get("against_count") or 0
            margin = f"  [{v['chamber']}: {f_}-{a_} {v.get('outcome') or ''} {v.get('vote_date') or ''}]"
        print(f"{score:>4}  {l['code']:<12} {status:<12} {l.get('interest_reason') or ''}{margin}")
        print(f"{'':>4}  {l['title'][:90]}")
        print(f"{'':>4}  {site}/legi/{l['id']}   →  python instagram_poster.py --law {l['id']} --dry-run")
        print()


if __name__ == "__main__":
    main()
