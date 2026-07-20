"""Politician name normalization — one source of truth for both chambers.

senat.ro publishes surnames in ALL CAPS ("STROE", "MĂLĂIESCU"); cdep.ro uses
Title Case. To standardize display, surnames are title-cased before storage.
NB: the ALL-CAPS form is used UPSTREAM (roster parse) to tell surname from
first name — normalize only after that split, never before.
"""
from __future__ import annotations

import re


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
