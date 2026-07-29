"""Politician name normalization — one source of truth for both chambers.

senat.ro publishes surnames in ALL CAPS ("STROE", "MĂLĂIESCU"); cdep.ro uses
Title Case. To standardize display, surnames are title-cased before storage.
NB: the ALL-CAPS form is used UPSTREAM (roster parse) to tell surname from
first name — normalize only after that split, never before.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional


def norm_name(s: str) -> str:
    """Lowercase + strip all diacritics, so 'ţ' (cedilla) and 'ț' (comma) match."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", (s or "").lower())
        if not unicodedata.combining(c)
    )


# Members whose official group label maps to the wrong party for our purposes.
# Keyed by norm_name("lastname")|norm_name("firstname").
#
# Ioana Grosaru holds a seat reserved for national-minority organisations
# (cdep: "Organizaţia minorităţilor naţionale: Asociaţia Italienilor din România
# - RO.AS.IT.") but sits as "Deputaţi neafiliaţi", which maps to IND. The site
# groups her by the mandate she was elected on, not the group she sits in.
#
# This MUST be consulted by every writer of politicians.party_id. It used to
# live in camera_scraper alone, so roster_scraper — which syncs party_id from
# the official roster on every full run — kept overwriting it with IND, and the
# label flip-flopped depending on which scraper ran last.
PARTY_OVERRIDE: dict[str, str] = {
    "grosaru|ioana": "MIN",
}


def party_override(last_name: str, first_name: str) -> Optional[str]:
    """The pinned party abbreviation for this member, or None."""
    return PARTY_OVERRIDE.get(f"{norm_name(last_name)}|{norm_name(first_name)}")


def titlecase_name(s: str) -> str:
    """Title-case a Romanian name: each hyphen/space-delimited token gets its
    first letter upper, the rest lower — diacritics preserved.
        "MĂLĂIESCU"        -> "Mălăiescu"
        "GHEORGHE-COSTIN"  -> "Gheorghe-Costin"
        "POPA ION"         -> "Popa Ion"
    Idempotent: already-title-cased names pass through unchanged.
    """
    if not s:
        return s
    return re.sub(
        r"[^\s\-]+",
        lambda m: m.group()[:1].upper() + m.group()[1:].lower(),
        s.strip(),
    )
