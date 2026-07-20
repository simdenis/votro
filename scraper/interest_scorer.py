"""Public-interest scores for laws (1-100), via Gemini — the post-selection signal.

Rates how interesting each law is to an ordinary Romanian citizen, from the
title + AI summary + category (text-only, no PDF). Scores land in
laws.interest_score with a one-line justification in laws.interest_reason
(doubles as caption inspiration for Instagram posts).

Batched: ~12 laws per request with JSON output, so a 500-law backlog is ~40
requests. Incremental & resumable like the summarizer: only laws without a
score we haven't checked, stamps interest_checked_at, stops cleanly on a
persistent 429. GEMINI_API_KEY may hold comma-separated keys (rotates on
daily-quota exhaustion).

Env: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY.
Usage:
    python interest_scorer.py [--limit N] [--redo CODE] [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import time

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("interest")

MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
BATCH = 12
_DELAY = 6.5  # stay under the ~10 requests/min free-tier limit

PROMPT = (
    "Ești editor la o publicație românească de transparență parlamentară, pe "
    "Instagram, pentru public larg. Pentru fiecare lege de mai jos dă:\n"
    "1) score: scor de interes public 1-100 — cât de mult i-ar păsa unui "
    "cetățean obișnuit (nu jurist, nu funcționar).\n"
    "   Repere: 80-100 lovește direct viața multor oameni (bani, taxe, pensii, "
    "salarii, sănătate, școală, prețuri, amenzi, drepturi, animale de companie) "
    "sau e subiect fierbinte; 50-79 afectează grupuri mari; 20-49 "
    "tehnic-administrativă; 1-19 rutină birocratică.\n"
    "2) reason: max 15 cuvinte, în română, de ce scorul.\n"
    "3) headline: un titlu SCURT și cârlig (max 10 cuvinte), în română simplă, "
    "care face omul să se oprească din scroll — spune pe limba omului DESPRE CE "
    "e legea, nu jargonul oficial. Fără cod de lege, fără ghilimele. Corect "
    "factual, fără exagerări sau senzaționalism. Exemple: Legea împotriva "
    "uciderii femeilor / Pensii mai mari pentru cei cu venituri mici / "
    "Fumatul interzis în mai multe spații.\n"
    "Răspunde STRICT cu JSON: o listă de obiecte "
    '{"code": "...", "score": N, "reason": "...", "headline": "..."}. '
    "Un obiect pentru fiecare lege, în ordinea dată, fără alt text.\n\n"
    "Legile:\n"
)


class RateLimited(Exception):
    pass


def gemini_scores(api_key: str, laws: list[dict]) -> dict[str, dict]:
    lines = []
    for l in laws:
        summary = (l.get("summary") or "").replace("\n", " ").strip()
        cat = l.get("law_category") or "necategorizată"
        lines.append(f"- {l['code']} | {cat} | {l['title'][:400]}" + (f" | Rezumat: {summary}" if summary else ""))
    body = {
        "contents": [{"parts": [{"text": PROMPT + "\n".join(lines)}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 4000,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    for wait_try in range(4):
        r = requests.post(GEMINI_URL, params={"key": api_key}, json=body, timeout=120)
        if r.status_code != 429:
            break
        if wait_try == 3:
            raise RateLimited(r.text[:200])
        log.info("429 — waiting 60s for the rate-limit window (try %d)", wait_try + 1)
        time.sleep(60)
    if not r.ok:
        log.warning("gemini error %s: %s", r.status_code, r.text[:150])
        return {}
    try:
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        items = json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        log.warning("unparseable response: %s", e)
        return {}
    out: dict[str, dict] = {}
    for it in items:
        code, score = it.get("code"), it.get("score")
        if not code or not isinstance(score, (int, float)):
            continue
        out[code.strip()] = {
            "score": max(1, min(100, int(score))),
            "reason": (it.get("reason") or "").strip()[:200] or None,
            "headline": (it.get("headline") or "").strip()[:120] or None,
        }
    return out


class Store:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def laws_to_process(self, limit: int, only: str | None) -> list[dict]:
        sel = "id,code,title,summary,law_category"
        params = {"select": sel, "order": "code.desc", "limit": str(limit)}
        if only:
            params = {"select": sel, "code": f"eq.{only}", "limit": "1"}
        else:
            # anything missing a score OR a headline (added by migration 039) —
            # so the headline backfills onto already-scored laws too
            params["or"] = "(interest_score.is.null,headline.is.null)"
        r = requests.get(f"{self.url}/rest/v1/laws", params=params, headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()

    def save(self, law_id: str, hit: dict | None) -> None:
        payload = {
            "interest_score": hit["score"] if hit else None,
            "interest_reason": hit["reason"] if hit else None,
            "headline": hit["headline"] if hit else None,
            "interest_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        r = requests.patch(f"{self.url}/rest/v1/laws", params={"id": f"eq.{law_id}"},
                           headers={**self.h, "Content-Type": "application/json"},
                           json=payload, timeout=30)
        r.raise_for_status()


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Public-interest law scores via Gemini")
    ap.add_argument("--limit", type=int, default=600, help="max laws this run")
    ap.add_argument("--redo", metavar="CODE", help="re-score one law by code")
    ap.add_argument("--dry-run", action="store_true", help="print, don't write")
    args = ap.parse_args()

    keys = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]
    if not keys:
        log.info("GEMINI_API_KEY not set — skipping interest scoring")
        return
    url, sb_key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not sb_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_KEY must be set")

    store = Store(url, sb_key)
    laws = store.laws_to_process(args.limit, args.redo)
    if not laws:
        log.info("nothing to score")
        return
    log.info("scoring %d laws in batches of %d", len(laws), BATCH)

    ki = 0
    scored = failed = 0
    for i in range(0, len(laws), BATCH):
        batch = laws[i:i + BATCH]
        while True:
            try:
                scores = gemini_scores(keys[ki], batch)
                break
            except RateLimited:
                ki += 1
                if ki >= len(keys):
                    log.warning("all Gemini keys rate-limited — stopping; next run resumes")
                    log.info("done: %d scored, %d failed", scored, failed)
                    return
                log.info("rotating to Gemini key #%d", ki + 1)
        for l in batch:
            hit = scores.get(l["code"])
            if args.dry_run:
                print(f"{l['code']}: {hit['score'] if hit else '—'}  ⟨{hit['headline'] if hit else '—'}⟩  {hit['reason'] if hit else '(no score)'}")
                continue
            store.save(l["id"], hit)
            scored += 1 if hit else 0
            failed += 0 if hit else 1
        time.sleep(_DELAY)
    log.info("done: %d scored, %d failed", scored, failed)


if __name__ == "__main__":
    main()
