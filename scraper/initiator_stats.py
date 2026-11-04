"""Who proposes the laws: per-party initiative counts and outcomes for /cine-propune.

Reads every law with a known initiator (laws.initiator_type, law_initiators from
the senat.ro fișe) and writes ONE precomputed JSON blob to
scrape_meta.initiator_stats. The page reads that single row: aggregating 24k
initiator rows inside the Worker would blow the Free plan's CPU cap.

Party = the signer's CURRENT party (politicians.party_id), the site-wide party
model (product decision 2026-06-28). Signatures the fișa scraper could not tie
to a politician are counted, not attributed.

Outcome per law, same rules as the cards (frontend/lib/law-stage.ts):
  lege      promulgated
  trecuta   passed both chambers, at the President / returned / at the CCR
  respinsa  registry says respins_definitiv, or the LATER chamber vote rejected it
  in_lucru  everything else

Usage: python initiator_stats.py [--dry-run]
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import os
import sys

import requests
from dotenv import load_dotenv

from paging import rest_all

load_dotenv(override=True)
URL, KEY = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
LIST_MAX = 40  # laws listed per party on the page (most recent first)


def get(table: str, **params: str) -> list[dict]:
    r = requests.get(f"{URL}/rest/v1/{table}", headers=H, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def outcome(st: dict, stage: str | None) -> str:
    ps = st.get("presidential_status")
    if ps == "promulgat":
        return "lege"
    if stage == "respins_definitiv":
        return "respinsa"
    if ps or stage in ("adoptat_final", "la_ccr"):
        return "trecuta"
    votes = sorted((d, o) for d, o in ((st.get("senate_vote_date"), st.get("senate_outcome")),
                                       (st.get("camera_vote_date"), st.get("camera_outcome"))) if o)
    if votes and votes[-1][1] == "respins":
        return "respinsa"
    if st.get("senate_outcome") == "adoptat" and st.get("camera_outcome") == "adoptat":
        return "trecuta"
    return "in_lucru"


def build() -> dict:
    laws = rest_all(get, "laws", select="id,code,title,headline,explainer->>titlu,initiator_type",
                    initiator_type="not.is.null")
    status = {s["law_id"]: s for s in rest_all(get, "law_status", order="law_id", select=(
        "law_id,presidential_status,senate_outcome,camera_outcome,senate_vote_date,camera_vote_date"))}
    stage = {i["law_id"]: i["stage"] for i in rest_all(get, "initiatives", select="law_id,stage",
                                                       law_id="not.is.null")}
    pols = {p["id"]: p["party_id"] for p in rest_all(get, "politicians", select="id,party_id")}
    parties = {p["id"]: p for p in get("parties", select="id,abbreviation,name")}
    signers = rest_all(get, "law_initiators", select="law_id,politician_id")

    by_law: dict[str, set] = collections.defaultdict(set)
    unmatched = 0
    for s in signers:
        party = pols.get(s["politician_id"]) if s["politician_id"] else None
        if party:
            by_law[s["law_id"]].add(party)
        else:
            unmatched += 1

    def last_vote(l: dict) -> str:
        st = status.get(l["id"]) or {}
        return max(st.get("senate_vote_date") or "", st.get("camera_vote_date") or "")

    groups: dict[str, dict] = {}

    def bucket(key: str, label: str, name: str) -> dict:
        return groups.setdefault(key, {"key": key, "label": label, "name": name, "total": 0, "solo": 0,
                                       "out": collections.Counter(), "laws": []})

    for l in sorted(laws, key=last_vote, reverse=True):
        out = outcome(status.get(l["id"]) or {}, stage.get(l["id"]))
        row = {"id": l["id"], "code": l["code"], "t": l.get("titlu") or l.get("headline") or l["title"], "o": out}
        if l["initiator_type"] == "guvern":
            keys = ["guvern"]
            bucket("guvern", "Guvernul", "Guvernul României")
        else:
            keys = [parties[p]["abbreviation"] for p in by_law.get(l["id"], ()) if p in parties]
            for p in by_law.get(l["id"], ()):
                if p in parties:
                    bucket(parties[p]["abbreviation"], parties[p]["abbreviation"], parties[p]["name"])
        for k in keys:
            g = groups[k]
            g["total"] += 1
            g["solo"] += len(keys) == 1
            g["out"][out] += 1
            if len(g["laws"]) < LIST_MAX:
                g["laws"].append({**row, "solo": len(keys) == 1})

    # all parliamentarians' proposals counted once each (the party rows overlap)
    parl = collections.Counter(outcome(status.get(l["id"]) or {}, stage.get(l["id"]))
                               for l in laws if l["initiator_type"] == "parlamentari")
    types = collections.Counter(l["initiator_type"] for l in laws)
    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "laws": len(laws),
        "by_type": dict(types),
        "parlamentari_out": dict(parl),
        "unmatched_signatures": unmatched,
        "signatures": len(signers),
        "groups": sorted(({**g, "out": dict(g["out"])} for g in groups.values()),
                         key=lambda g: (g["key"] != "guvern", -g["total"])),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not URL or not KEY:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    stats = build()
    for g in stats["groups"]:
        print(f"{g['label']:8} {g['total']:4} solo {g['solo']:4}  {g['out']}")
    print(f"{stats['laws']} laws · {stats['by_type']} · unmatched signatures {stats['unmatched_signatures']}/{stats['signatures']}")
    if args.dry_run:
        return
    now = stats["generated_at"]
    r = requests.post(f"{URL}/rest/v1/scrape_meta", params={"on_conflict": "key"},
                      headers={**H, "Prefer": "resolution=merge-duplicates"},
                      json=[{"key": "initiator_stats", "value": json.dumps(stats, ensure_ascii=False), "updated_at": now}],
                      timeout=60)
    r.raise_for_status()
    print(f"initiator_stats written ({len(json.dumps(stats, ensure_ascii=False)) // 1024} KB)")


if __name__ == "__main__":
    main()
