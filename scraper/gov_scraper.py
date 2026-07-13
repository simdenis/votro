"""Government roles (politicians.gov_role) from the official cabinet page.

Source: gov.ro "Cabinetul de miniștri" — each member is a
`.ministriiDescriere` block: <h3><a>Name</a></h3><p>function</p>. MPs serving
in the Government never vote in plen; the gov_role label ('premier' /
'vicepremier' / 'ministru') keeps them out of the shame corner, the party
absence average, and explains their 100% absence on lists and profiles.
Migration 022 seeded the labels by hand; this scraper keeps them current when
the cabinet changes.

Matching is token-based and order-free: gov.ro writes "Tánczos Barna"
(Hungarian order) while the roster has first_name="Barna" name="TÁNCZOS", and
"Oana-Clara Gheorghiu" (vicepremier, not an MP) must NOT match the deputy
Andrei-Florin Gheorghiu — the surname tokens must all appear in the cabinet
name AND at least one first-name token must too.

Labels are add-only: gov_role marks anyone who served in the Government this
legislature (ex-members keep it — their absence while in office was
structural). A broken parse (<10 members) never touches labels.

gov.ro silently drops non-RO IPs (the EU VPS times out at TCP level — the
inverse of cdep.ro's non-EU block). On unreachable it exits 0 with labels
untouched, so the daily VPS run stays green; run it from a Romanian IP when
the government changes.

Env: SUPABASE_URL, SUPABASE_KEY.
Usage:
    python gov_scraper.py [--dry-run]
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import unicodedata

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gov")

UA = {"User-Agent": "Mozilla/5.0 (compatible; VotRO/1.0; +https://vot-romania.vercel.app)"}
CABINET_URL = "https://www.gov.ro/ro/guvernul/cabinetul-de-ministri"

_MEMBER = re.compile(
    r"ministriiDescriere.*?<h3[^>]*>\s*<a[^>]*>([^<]+)</a>\s*</h3>\s*<p>([^<]+)</p>",
    re.S,
)


def _tokens(s: str) -> set[str]:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return {t for t in re.split(r"[\s\-,.]+", s.lower()) if t}


def _role(function: str) -> str:
    f = function.lower()
    if "viceprim" in f:
        return "vicepremier"
    if "prim-ministru" in f:
        return "premier"
    return "ministru"


def parse_cabinet(html: str) -> list[tuple[str, str]]:
    """[(name, role), ...] — one entry per cabinet member, PM included."""
    return [(name.strip(), _role(func)) for name, func in _MEMBER.findall(html)]


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="VotRO — government roles scraper")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    try:
        r = requests.get(CABINET_URL, headers=UA, timeout=30)
        r.raise_for_status()
    except requests.RequestException as e:
        log.warning("gov.ro unreachable (drops non-RO IPs) — labels unchanged: %s", e)
        return
    cabinet = parse_cabinet(r.text)
    log.info("parsed %d cabinet members", len(cabinet))
    if len(cabinet) < 10:
        sys.exit("ERROR: cabinet page parsed <10 members — layout changed? Not touching labels.")

    from supabase import create_client

    db = create_client(url, key)
    pols = (
        db.table("politicians")
        .select("id, name, first_name, chamber, gov_role")
        .eq("active", True)
        .execute()
        .data
    )

    matched: dict[str, str] = {}  # politician id → role
    for cab_name, role in cabinet:
        cab_tokens = _tokens(cab_name)
        hits = [
            p for p in pols
            if _tokens(p["name"]) <= cab_tokens and _tokens(p["first_name"]) & cab_tokens
        ]
        if len(hits) > 1:
            log.warning("%s: ambiguous — matches %d MPs, skipping", cab_name, len(hits))
            continue
        if hits:
            matched[hits[0]["id"]] = role
            log.info("%s (%s) → %s %s [%s]", cab_name, role,
                     hits[0]["first_name"], hits[0]["name"], hits[0]["chamber"])
        else:
            log.info("%s (%s) → not an MP", cab_name, role)

    # Add-only: gov_role means "served in Government during this legislature",
    # not "currently in cabinet". An ex-minister's plenary absence while in
    # office was structural — clearing the label on exit would dump months of
    # structural absence into the shame ranking (the Rogobete case, jul 2026).
    changes = 0
    for p in pols:
        new_role = matched.get(p["id"])
        if new_role and new_role != p.get("gov_role"):
            log.info("update %s %s: %r → %r", p["first_name"], p["name"], p.get("gov_role"), new_role)
            if not args.dry_run:
                db.table("politicians").update({"gov_role": new_role}).eq("id", p["id"]).execute()
            changes += 1

    log.info("done: %d MPs in government, %d label change(s)%s",
             len(matched), changes, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
