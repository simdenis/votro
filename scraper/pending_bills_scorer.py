"""AI summary + public-interest score for pending (tacit-term) bills, via Gemini.

One call per bill: the expunere de motive PDF (pending_bills.pdf_url, filled by
tacit_scraper) goes in as inline data and Gemini returns JSON with a 2-3
sentence plain-Romanian summary plus a 1-100 interest score (same rubric as
interest_scorer.py). Bills without a pdf_url are scored from the title alone —
weaker, but better than nothing.

Incremental & resumable like the other Gemini scrapers: only rows with
ai_checked_at IS NULL, stamps ai_checked_at either way, stops cleanly on a
persistent 429. GEMINI_API_KEY may hold comma-separated keys (rotates on
daily-quota exhaustion). PDFs live on cdep.ro → run from the EU VPS.

Env: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY.
Usage:
    python pending_bills_scorer.py [--limit N] [--redo CODE] [--dry-run]
"""
from __future__ import annotations

import argparse
import base64
import datetime
import json
import logging
import os
import time

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("pending-ai")

MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
_DELAY = 6.5  # stay under the ~10 requests/min free-tier limit
_TIMEOUT = 120

PROMPT = (
    "Ești editor la o publicație românească de transparență parlamentară, "
    "pentru public larg. Primești expunerea de motive a unui proiect de lege "
    "aflat în termen de adoptare tacită în Parlament.\n"
    "1) Rezumă proiectul în 2-3 propoziții simple, în română, fără jargon "
    "juridic — ce s-ar schimba concret pentru oameni.\n"
    "2) Dă un scor de interes public de la 1 la 100: cât de mult i-ar păsa "
    "unui cetățean obișnuit.\n"
    "Repere: 80-100 = lovește direct viața multor oameni (bani, taxe, pensii, "
    "salarii, sănătate, școală, prețuri, amenzi, drepturi); 50-79 = grupuri "
    "mari / potențial real de discuție; 20-49 = tehnic-administrativ; 1-19 = "
    "ratificări de rutină, birocrație internă.\n"
    'Răspunde STRICT cu JSON: {"summary": "...", "score": N, '
    '"reason": "max 15 cuvinte, în română"} — fără alt text.'
)


class RateLimited(Exception):
    pass


def _gemini(api_key: str, parts: list[dict]) -> dict | None:
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0, "maxOutputTokens": 700,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    for wait_try in range(4):
        r = requests.post(GEMINI_URL, params={"key": api_key}, json=body, timeout=_TIMEOUT)
        if r.status_code != 429:
            break
        if wait_try == 3:
            raise RateLimited(r.text[:200])
        log.info("429 — waiting 60s for the rate-limit window (try %d)", wait_try + 1)
        time.sleep(60)
    if not r.ok:
        log.warning("gemini error %s: %s", r.status_code, r.text[:150])
        return None
    try:
        item = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        log.warning("unparseable response: %s", e)
        return None
    score = item.get("score")
    if not isinstance(score, (int, float)):
        return None
    return {
        "summary": (item.get("summary") or "").strip()[:1200] or None,
        "score": max(1, min(100, int(score))),
        "reason": (item.get("reason") or "").strip()[:200] or None,
    }


def rate_bill(api_key: str, bill: dict) -> dict | None:
    parts: list[dict] = []
    if bill.get("pdf_url"):
        try:
            pdf = requests.get(bill["pdf_url"], timeout=60,
                               headers={"User-Agent": "Mozilla/5.0"})
            if pdf.ok and pdf.content[:4] == b"%PDF":
                parts.append({"inline_data": {
                    "mime_type": "application/pdf",
                    "data": base64.standard_b64encode(pdf.content).decode()}})
            else:
                log.info("%s: pdf fetch %s / not a PDF — falling back to title",
                         bill["code"], pdf.status_code)
        except requests.RequestException as e:
            log.info("%s: pdf fetch failed (%s) — falling back to title", bill["code"], e)
    parts.append({"text": PROMPT + f"\n\nTitlul proiectului: {bill.get('title') or bill['code']}"})
    return _gemini(api_key, parts)


class Store:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def bills(self, limit: int, only: str | None) -> list[dict]:
        params = {"select": "id,code,title,pdf_url", "order": "tacit_deadline.asc", "limit": str(limit)}
        if only:
            params = {"select": "id,code,title,pdf_url", "code": f"eq.{only}", "limit": "1"}
        else:
            params["ai_checked_at"] = "is.null"
        r = requests.get(f"{self.url}/rest/v1/pending_bills", params=params, headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()

    def save(self, bill_id: str, res: dict | None) -> None:
        payload: dict = {"ai_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        if res:
            payload |= {"summary": res["summary"], "interest_score": res["score"],
                        "interest_reason": res["reason"]}
        r = requests.patch(f"{self.url}/rest/v1/pending_bills", params={"id": f"eq.{bill_id}"},
                           headers={**self.h, "Content-Type": "application/json"},
                           json=payload, timeout=30)
        r.raise_for_status()


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="AI summary + interest score for pending bills")
    ap.add_argument("--limit", type=int, default=100, help="max bills this run")
    ap.add_argument("--redo", metavar="CODE", help="re-rate one bill by code (e.g. BP186/2026)")
    ap.add_argument("--dry-run", action="store_true", help="print, don't write")
    args = ap.parse_args()

    keys = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]
    if not keys:
        log.info("GEMINI_API_KEY not set — skipping (tacit ranking stays deadline-only)")
        return
    url, skey = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and skey):
        raise SystemExit("SUPABASE_URL and SUPABASE_KEY must be set")

    store = Store(url, skey)
    bills = store.bills(args.limit, args.redo)
    if not bills:
        log.info("nothing to rate")
        return
    log.info("%d pending bill(s) to rate", len(bills))

    ki = 0
    done = 0
    for b in bills:
        try:
            res = rate_bill(keys[ki], b)
        except RateLimited:
            ki += 1
            if ki >= len(keys):
                log.info("daily quota exhausted on all %d key(s) — resuming next run", len(keys))
                break
            log.info("key %d exhausted — rotating", ki)
            res = rate_bill(keys[ki], b)
        if args.dry_run:
            log.info("%s → %s", b["code"], res)
        else:
            store.save(b["id"], res)
            done += 1
            if res:
                log.info("%s → %d (%s)", b["code"], res["score"], res["reason"])
            else:
                log.info("%s → no result (stamped, will not retry)", b["code"])
        time.sleep(_DELAY)
    log.info("done: %d saved", done)


if __name__ == "__main__":
    main()
