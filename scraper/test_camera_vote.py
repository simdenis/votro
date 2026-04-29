"""
Sanity-check: fetch and parse a single Camera Deputaților vote, print everything.
No Supabase connection required. Run this first to verify the HTML parser works
against the live site before running the full scraper.

Usage:
  cd scraper
  .venv/bin/python3 test_camera_vote.py [--idv NNN] [--date YYYYMMDD]

Defaults to a recent known vote id if no args given.
"""

import argparse
import sys
import os
import datetime

sys.path.insert(0, os.path.dirname(__file__))

import requests
from camera_scraper import CameraScraper, _split_name

HEADERS = {
    "User-Agent": (
        "VotRO/1.0 Romanian parliamentary vote tracker "
        "(research; contact: siminiucdenis@gmail.com)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
}

LIST_URL = "https://www.cdep.ro/pls/steno/evot.lista"


def test_list(date_str: str) -> list[int]:
    url = f"{LIST_URL}?dat={date_str}&idl=1"
    print(f"Fetching list: {url}\n")
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.encoding = "utf-8"
    print(f"HTTP status : {r.status_code}")
    print(f"Response size: {len(r.text):,} chars\n")

    scraper = CameraScraper.__new__(CameraScraper)
    import re
    found = re.findall(r"[?&]idv=(\d+)", r.text)
    idvs = list(dict.fromkeys(int(x) for x in found))
    print(f"Found {len(idvs)} idv(s): {idvs}")
    return idvs


def test_detail(idv: int) -> None:
    url = f"{LIST_URL}?idv={idv}&idl=1"
    print(f"\nFetching detail: {url}\n")
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.encoding = "utf-8"
    print(f"HTTP status : {r.status_code}")
    print(f"Response size: {len(r.text):,} chars\n")

    if r.status_code != 200:
        print("ERROR: unexpected HTTP status")
        sys.exit(1)

    scraper = CameraScraper.__new__(CameraScraper)
    detail = scraper._parse_detail(idv, r.text)

    if not detail:
        print("ERROR: parsing returned None")
        sys.exit(1)

    print("=" * 60)
    print("PARSED VOTE DETAIL")
    print("=" * 60)
    print(f"idv        : {detail.cdep_vote_id}")
    print(f"Law code   : {detail.law_code or '[not found]'}")
    print(f"Vote type  : {detail.vote_type or '[not found]'}")
    print(f"Vote date  : {detail.vote_date or '[not found]'}")
    print(f"Outcome    : {detail.outcome or '[not found]'}")
    print(f"Title      : {(detail.law_title or '[not found]')[:120]}")

    print("\n--- Vote totals ---")
    t = detail.totals
    print(f"  Present      : {t.present}")
    print(f"  For          : {t.for_}")
    print(f"  Against      : {t.against}")
    print(f"  Abstentions  : {t.abstentions}")
    print(f"  Not voted    : {t.not_voted}")
    print(f"  Absent       : {t.absent}")

    print(f"\n--- Party breakdown ({len(detail.party_breakdown)} parties) ---")
    if detail.party_breakdown:
        print(f"  {'Party':<20} {'For':>5} {'Against':>8} {'Abst':>6} {'NoVote':>8}")
        print(f"  {'-'*20} {'-'*5} {'-'*8} {'-'*6} {'-'*8}")
        for pb in detail.party_breakdown:
            print(f"  {pb.abbreviation or pb.name:<20} {pb.for_:>5} {pb.against:>8} {pb.abstentions:>6} {pb.not_voted:>8}")
    else:
        print("  (none parsed)")

    print(f"\n--- Deputy votes ({len(detail.deputy_votes)} deputies) ---")
    if detail.deputy_votes:
        for dv in detail.deputy_votes[:20]:
            print(f"  {dv.last_name:<20} {dv.first_name:<15} {dv.party_abbr:<8} → {dv.vote_choice}")
        if len(detail.deputy_votes) > 20:
            print(f"  … and {len(detail.deputy_votes) - 20} more")

        from collections import Counter
        counts = Counter(dv.vote_choice for dv in detail.deputy_votes)
        print(f"\n  Choice breakdown: {dict(counts)}")
    else:
        print("  (none parsed)")
        print("\n  ⚠  PARSER NEEDS ADJUSTMENT — dump first 3000 chars of HTML below:")
        print("-" * 60)

    # Validation
    print("\n--- Validation ---")
    ok = True
    if not detail.law_code:
        print("  WARN: law code missing")
        ok = False
    if not detail.vote_date:
        print("  WARN: vote date missing")
        ok = False
    if not detail.deputy_votes:
        print("  WARN: deputy list empty — HTML structure differs from expected")
        print("  → Run with --dump to see the raw HTML and adjust _parse_detail()")
        ok = False
    if ok:
        print("  All checks passed ✓")
    print()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--idv", type=int, help="Vote idv to fetch")
    parser.add_argument("--date", help="Date YYYYMMDD to list votes for")
    parser.add_argument("--dump", action="store_true", help="Print raw HTML of the detail page")
    args = parser.parse_args()

    if args.date:
        idvs = test_list(args.date)
        if idvs and not args.idv:
            print(f"\nTesting first idv: {idvs[0]}")
            test_detail(idvs[0])
        return

    idv = args.idv or 65000  # adjust to a known recent vote
    test_detail(idv)

    if args.dump:
        url = f"{LIST_URL}?idv={idv}&idl=1"
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.encoding = "utf-8"
        print("\n--- RAW HTML (first 5000 chars) ---")
        print(r.text[:5000])


if __name__ == "__main__":
    main()
