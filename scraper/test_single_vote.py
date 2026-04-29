"""
Sanity-check: fetch and parse exactly this vote page, print everything.
No Supabase connection required.

URL: https://www.senat.ro/VoturiPlenDetaliu.aspx?AppID=95BADB90-7E3F-4E98-B417-67F451CD1C94&Cod=27412&Data=2026-04-01
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import requests
from senat_scraper import SenatScraper, _abbreviate

TEST_URL = (
    "https://www.senat.ro/VoturiPlenDetaliu.aspx"
    "?AppID=95BADB90-7E3F-4E98-B417-67F451CD1C94"
    "&Cod=27412"
    "&Data=2026-04-01"
)
TEST_APP_ID = "95BADB90-7E3F-4E98-B417-67F451CD1C94"

HEADERS = {
    "User-Agent": (
        "VotRO/1.0 Romanian parliamentary vote tracker "
        "(research; contact: siminiucdenis@gmail.com)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
}


def run() -> None:
    print(f"Fetching: {TEST_URL}\n")

    r = requests.get(TEST_URL, headers=HEADERS, timeout=30)
    r.encoding = "utf-8"
    print(f"HTTP status : {r.status_code}")
    print(f"Content-Type: {r.headers.get('content-type', '?')}")
    print(f"Response size: {len(r.text):,} chars\n")

    if r.status_code != 200:
        print("ERROR: unexpected HTTP status")
        sys.exit(1)

    # Reuse the parser from SenatScraper (instantiate without Supabase)
    scraper = SenatScraper.__new__(SenatScraper)
    detail = scraper._parse_detail(TEST_APP_ID, r.text)

    if not detail:
        print("ERROR: parsing returned None")
        sys.exit(1)

    # ── Print results ──────────────────────────────────────────
    print("=" * 60)
    print("PARSED VOTE DETAIL")
    print("=" * 60)
    print(f"AppID      : {detail.app_id}")
    print(f"Law code   : {detail.law_code or '[not found]'}")
    print(f"Vote type  : {detail.vote_type or '[not found]'}")
    print(f"Vote date  : {detail.vote_date or '[not found]'}")
    print(f"Title      : {(detail.law_title or '[not found]')[:120]}")

    print("\n--- Vote totals ---")
    t = detail.totals
    print(f"  Present      : {t.present}")
    print(f"  For          : {t.for_}")
    print(f"  Against      : {t.against}")
    print(f"  Abstentions  : {t.abstentions}")
    print(f"  Not voted    : {t.not_voted}")

    print(f"\n--- Party breakdown ({len(detail.party_breakdown)} parties) ---")
    if detail.party_breakdown:
        print(f"  {'Party':<20} {'For':>5} {'Against':>8} {'Abst':>6} {'NoVote':>8}")
        print(f"  {'-'*20} {'-'*5} {'-'*8} {'-'*6} {'-'*8}")
        for pb in detail.party_breakdown:
            print(f"  {pb.abbreviation or pb.name:<20} {pb.for_:>5} {pb.against:>8} {pb.abstentions:>6} {pb.not_voted:>8}")
    else:
        print("  (none parsed)")

    print(f"\n--- Senator votes ({len(detail.senator_votes)} senators) ---")
    if detail.senator_votes:
        # Show first 20 and summary counts
        for sv in detail.senator_votes[:20]:
            print(f"  {sv.last_name:<20} {sv.first_name:<15} {sv.party_abbr:<8} → {sv.vote_choice}")
        if len(detail.senator_votes) > 20:
            print(f"  … and {len(detail.senator_votes) - 20} more")

        from collections import Counter
        counts = Counter(sv.vote_choice for sv in detail.senator_votes)
        print(f"\n  Choice breakdown: {dict(counts)}")
    else:
        print("  (none parsed)")

    # Validation checks
    print("\n--- Validation ---")
    ok = True
    if not detail.law_code:
        print("  WARN: law code missing")
        ok = False
    if not detail.vote_date:
        print("  WARN: vote date missing")
        ok = False
    if not detail.senator_votes:
        print("  WARN: senator list empty — HTML structure may have changed")
        ok = False
    else:
        # For this specific vote (L95/2026, 2026-04-01) we expect ~97 senators
        if len(detail.senator_votes) < 50:
            print(f"  WARN: unexpectedly few senators ({len(detail.senator_votes)})")
            ok = False

    if ok:
        print("  All checks passed ✓")

    print()


if __name__ == "__main__":
    run()
