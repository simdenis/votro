"""Pre-publish check for the Instagram autopilot.

Two layers:
1. Mechanical (always enforced, no content parsing): every slide URL returns a
   200 PNG/JPEG of the right size (feed 1080×1350, story 1080×1920) and big
   enough not to be a blank render (a story frame whose inner card failed comes
   back ~46 KB). Doubles as the pre-warm IG's fetcher needs.
2. Claude Haiku on the TEXT that goes onto the cards — headline, title,
   summary, code, status fields from the DB, per slide — plus the caption and
   the facts the post was built from → {ok, problems}. Catches contradictions
   (caption vs slide data, status vs outcome), placeholder text, garbled
   diacritics, a named ranking on the feed. It cannot tell whether the DATA is
   true — that is validate.py's and the absence guards' job.

POST_CHECK=log (default) records the AI verdict and pings on a would-block but
publishes anyway — the first-week calibration. POST_CHECK=enforce blocks on a
failed or unavailable AI verdict. POST_CHECK=off skips the AI layer only.
Every verdict is appended to post_checks.jsonl next to the post ledger.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import struct
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import requests

MODEL = os.environ.get("POST_CHECK_MODEL", "claude-haiku-4-5")
LOG = Path(os.environ.get("VOTRO_LOG_DIR", "/var/log/votro")) / "post_checks.jsonl"
SIZES = {"feed": (1080, 1350), "story": (1080, 1920)}
MIN_BYTES = {"feed": 20_000, "story": 90_000}

SYSTEM = """You are the last check before a post goes out on @la.butoane, a neutral Romanian civic account that publishes how Parliament votes. You get the text that will be drawn on each slide (straight from the database), the caption, and the facts the post was generated from.

Fail the post only for a concrete defect in that text:
- a law code, count or number that differs between the caption and the slides (e.g. the cover says 7, the caption lists 6; a code on a slide is missing from the caption or spelled differently)
- placeholder or debugging text (undefined, null, NaN, {…}, lorem ipsum, "Invalid Date") in a field that will be shown
- garbled Romanian (mojibake like Ã¢ or Å£, words cut mid-way, broken sentences) in a headline, summary or caption
- a headline that claims something the title/summary does not support
- on a FEED post: a ranking or list of individually named MPs for absences or party switching (those may only run as stories)

Legislative procedure, statuses and dates are checked elsewhere — do not judge them. Old cedilla letters (ş ţ) and empty optional fields are fine. Do not fail for style, wording, political content, or for data you cannot verify. When everything is consistent, ok is true and problems is empty. Write each problem in Romanian, short, naming the slide number."""

SCHEMA = {
    "type": "object",
    "properties": {
        "ok": {"type": "boolean"},
        "problems": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["ok", "problems"],
    "additionalProperties": False,
}


@dataclass
class Verdict:
    ok: bool
    problems: list[str] = field(default_factory=list)
    mechanical: bool = False     # a mechanical failure — always blocks
    unchecked: bool = False      # AI layer skipped or unavailable


def mode() -> str:
    return os.environ.get("POST_CHECK", "log")


def _png_size(b: bytes) -> tuple[int, int] | None:
    if b[:8] == b"\x89PNG\r\n\x1a\n" and b[12:16] == b"IHDR":
        return struct.unpack(">II", b[16:24])
    return None


def _jpeg_size(b: bytes) -> tuple[int, int] | None:
    if b[:2] != b"\xff\xd8":
        return None
    i = 2
    while i + 9 < len(b):
        if b[i] != 0xFF:
            return None
        marker, seg = b[i + 1], struct.unpack(">H", b[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", b[i + 5:i + 9])
            return w, h
        i += 2 + seg
    return None


def fetch(url: str, kind: str, tries: int = 4) -> str:
    """Fetch one slide and return a problem ('' when fine). Retries small or
    failed renders: cold og routes and the story frame's inner fetch come back
    blank the first time."""
    problem = ""
    for attempt in range(tries):
        try:
            r = requests.get(url, timeout=90)
        except requests.RequestException as e:
            problem = f"nu se încarcă ({type(e).__name__})"
        else:
            ct = r.headers.get("content-type", "").split(";")[0]
            size = _png_size(r.content) or _jpeg_size(r.content)
            if r.status_code != 200:
                problem = f"HTTP {r.status_code}"
            elif ct not in ("image/png", "image/jpeg") or not size:
                problem = f"nu e imagine ({ct or 'fără content-type'})"
            elif size != SIZES[kind]:
                problem = f"dimensiune {size[0]}×{size[1]}, așteptat {SIZES[kind][0]}×{SIZES[kind][1]}"
            elif len(r.content) < MIN_BYTES[kind]:
                problem = f"doar {len(r.content) // 1000} KB — probabil randare goală"
            else:
                return ""
        if attempt < tries - 1:
            time.sleep(5)
    return problem


def _ai(kind: str, caption: str, texts: list[dict], facts: dict) -> Verdict:
    import anthropic

    prompt = (f"Post type: {kind.upper()}{' (stories have no caption)' if kind == 'story' else ''}\n\n"
              f"Text on each slide:\n{json.dumps(texts, ensure_ascii=False, indent=1)}\n\n"
              f"Facts the post was built from:\n{json.dumps(facts, ensure_ascii=False, indent=1)}\n\n"
              f"Caption:\n{caption or '(none)'}")
    resp = anthropic.Anthropic().messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM,
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    if resp.stop_reason == "refusal":
        return Verdict(False, ["verificarea AI a refuzat să evalueze postarea"], unchecked=True)
    data = json.loads(next(b.text for b in resp.content if b.type == "text"))
    return Verdict(bool(data["ok"]), [str(p) for p in data.get("problems", [])])


def review(kind: str, urls: list[str], caption: str, texts: list[dict], facts: dict) -> Verdict:
    """Check one post (kind 'feed' or 'story'; urls exactly as IG will fetch
    them; texts = what each slide will show, in slide order)."""
    bad = [f"slide {i}: {p}" for i, u in enumerate(urls, 1) if (p := fetch(u, kind))]
    if bad:
        v = Verdict(False, bad, mechanical=True)
    elif mode() == "off":
        v = Verdict(True, unchecked=True)
    else:
        try:
            v = _ai(kind, caption, texts, facts)
        except Exception as e:  # API down, bad key, unparsable JSON: a verdict we don't have
            v = Verdict(False, [f"verificarea AI indisponibilă: {type(e).__name__}: {str(e)[:200]}"], unchecked=True)
    _log(kind, urls, facts, v)
    return v


def _log(kind: str, urls: list[str], facts: dict, v: Verdict) -> None:
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"at": dt.datetime.now(dt.timezone.utc).isoformat(), "mode": mode(), "model": MODEL,
                                "kind": kind, "ok": v.ok, "mechanical": v.mechanical, "unchecked": v.unchecked,
                                "problems": v.problems, "facts": facts, "urls": urls}, ensure_ascii=False) + "\n")
    except OSError as e:
        print(f"post_check log failed: {e}", file=sys.stderr)
