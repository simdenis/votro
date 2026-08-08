"""Structured two-part law summaries from the bill text + expunere de motive, via Gemini.

Reads both official PDFs natively (multimodal — senat.ro text layers are often
garbled OCR) and returns JSON with two fields: `ce_face`, a neutral mechanical
description of what the bill changes (stored in laws.summary, the one-liner
every list/caption/OG card already consumes), and `motivare_initiatori`, the
sponsors' stated justification quoted from the expunere and explicitly framed
as their claim. laws.summary_source records what the model actually read
('em+text' | 'em' | 'text' | 'title') — never 'em+text' unless the bill-text
fetch succeeded. Every summary is flagged `summary_is_ai=true`; the official
PDFs stay linked via `em_url` / `bill_pdf_url`.

Incremental & resumable: only processes laws with no summary that we haven't
checked yet, stamps `summary_checked_at` so failed PDFs aren't retried forever,
and stops cleanly on a 429 (free-tier rate limit) so the next run picks up
where it left off. Falls back to Claude Haiku when every Gemini key is spent.

Requires migration 054 (motivare_initiatori / bill_pdf_url / summary_source).

Env: GEMINI_API_KEY (free from aistudio.google.com), SUPABASE_URL, SUPABASE_KEY.
Usage:
    python gemini_summarizer.py [--limit N] [--redo CODE] [--dry-run]
"""
from __future__ import annotations

import argparse
import base64
import datetime
import json
import logging
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gemini-summary")

CODE_RE = re.compile(r"^L(\d+)/(\d{4})$")
MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
UA = {"User-Agent": "Mozilla/5.0"}
_DELAY = 6.5  # stay under the ~10 requests/min free-tier limit

PROMPT = (
    "Primești documentele oficiale ale unui proiect de lege românesc, fiecare "
    "precedat de un rând care spune care e care: [1] textul proiectului (forma "
    "inițiatorului) și [2] expunerea de motive — textul prin care inițiatorii își "
    "susțin propunerea. Oricare poate lipsi. Răspunde STRICT cu JSON: "
    '{"ce_face": "...", "motivare_initiatori": "..." sau null}.\n\n'
    "CE_FACE — descriere mecanică și neutră a ceea ce ar schimba proiectul, "
    "pentru un cetățean fără studii juridice:\n"
    "- descrie DOAR modificările normative: ce lege/articol se modifică, se "
    "introduce sau se abrogă și care e regula nouă; unde ajută, dă trimiterea "
    "între paranteze („(art. 31, alineat nou)”)\n"
    "- fiecare afirmație trebuie să fie verificabilă direct în textul "
    "proiectului sau în expunere; dacă nu o poți ancora într-una din surse, "
    "OMITE-O\n"
    "- INTERZIS orice cuvânt care evaluează importanța, intenția politică sau "
    "caracterul controversat al proiectului\n"
    "- INTERZIS să afirmi stadiul legislativ („devine lege”, „va intra în "
    "vigoare”) — e un proiect; folosește condiționalul sau „proiectul prevede…”\n"
    "- NU prelua ca fapt scopurile sau beneficiile invocate de inițiatori — "
    "acelea merg exclusiv în motivare_initiatori\n"
    "- verbe neutre: prevede, introduce, modifică, stabilește, elimină, "
    "permite, amână; 2–4 fraze, STRICT maximum 70 de cuvinte — dacă proiectul "
    "modifică multe articole, alege cele mai importante 2-3 modificări, nu le "
    "enumera pe toate; limbaj simplu, diacritice corecte, fără markdown\n\n"
    "MOTIVARE_INITIATORI — justificarea declarată de inițiatori, exclusiv din "
    "expunerea de motive:\n"
    "- totul încadrat explicit ca afirmația lor: „Inițiatorii invocă…”, "
    "„Potrivit expunerii de motive…” — niciodată ca fapt\n"
    "- pentru orice afirmație-cheie (cifre, condamnări, efecte promise), "
    "CITEAZĂ scurt expunerea între ghilimele în loc s-o parafrazezi\n"
    "- dacă expunerea invocă decizii CCR, hotărâri CEDO, directive UE sau "
    "jaloane PNRR, menționează-le cu numărul/numele lor\n"
    "- nu valida, nu contrazice, nu completa afirmațiile inițiatorilor; doar "
    "atribuie-le; 2–4 fraze, STRICT maximum 100 de cuvinte — alege afirmațiile "
    "centrale, nu tot cuprinsul expunerii\n"
    "- dacă expunerea lipsește sau e ilizibilă: null\n\n"
    "Dacă ai doar titlul (ambele documente lipsă/ilizibile): ce_face începe "
    "obligatoriu cu „Pe baza titlului oficial:” și descrie doar ce reiese din "
    "titlu, fără detalii inventate. Dacă nici titlul nu e informativ, răspunde "
    '{"ce_face": "INDISPONIBIL", "motivare_initiatori": null}.\n'
    "Închide întotdeauna ghilimelele deschise și termină fiecare câmp cu punct."
)

_DOC_LABELS = {
    "text": "Documentul [1] — textul proiectului (forma inițiatorului):",
    "em": "Documentul [2] — expunerea de motive:",
}


def em_url_for(code: str) -> str | None:
    m = CODE_RE.match(code.strip())
    if not m:
        return None
    num, year = int(m.group(1)), int(m.group(2))
    return f"https://www.senat.ro/legis/PDF/{year}/{year % 100:02d}L{num:03d}EM.PDF"


def fg_url_for(code: str) -> str | None:
    """Bill-text PDF (forma inițiatorului) — same senat.ro pattern, FG suffix.
    Verified present for 29/29 sampled laws across 2010-2026."""
    m = CODE_RE.match(code.strip())
    if not m:
        return None
    num, year = int(m.group(1)), int(m.group(2))
    return f"https://www.senat.ro/legis/PDF/{year}/{year % 100:02d}L{num:03d}FG.PDF"


def fetch_pdf(url: str | None) -> bytes | None:
    if not url:
        return None
    try:
        r = requests.get(url, timeout=45, headers=UA)
    except requests.RequestException as e:
        log.warning("PDF fetch failed (%s): %s", url, e)
        return None
    if r.ok and "pdf" in r.headers.get("content-type", "").lower() and len(r.content) >= 1000:
        return r.content
    return None


def summary_source_for(fg_pdf: bytes | None, em_pdf: bytes | None) -> str:
    if em_pdf and fg_pdf:
        return "em+text"
    if em_pdf:
        return "em"
    if fg_pdf:
        return "text"
    return "title"


class RateLimited(Exception):
    pass


# Models add markdown drift now and then no matter what the prompt says —
# strip it so both fields read as plain prose everywhere they're shown.
_MD_HEADER = re.compile(r"^\s*\*\*[^*\n]{5,160}\*\*\s*\n+")


def _clean_field(text: str) -> str:
    return _MD_HEADER.sub("", text).replace("**", "").strip()


# A cap in the prompt is a request; the finish-reason check is the guarantee.
# A summary that stops mid-sentence must never be stored — retry once with a
# brevity note (temp 0 needs a changed prompt to change the output), then give
# up rather than save a cut-off sentence.
_RETRY_NOTE = (
    "\n\nATENȚIE: încercarea anterioară a depășit limita de lungime și a fost "
    "tăiată. Respectă STRICT limitele: ce_face maximum 70 de cuvinte, "
    "motivare_initiatori maximum 100 de cuvinte. Alege doar esențialul."
)
_TERMINAL = tuple('.!?”"»)]')
_CE_MAX, _MOT_MAX = 70, 100  # word caps; retry when exceeded past ~15% slack


def _looks_cut(res: dict) -> bool:
    return any(v and not v.rstrip().endswith(_TERMINAL)
               for v in (res["ce_face"], res["motivare_initiatori"]))


def _tidy_field(text: str | None) -> str | None:
    """Close an unbalanced „quote and add the final period. Haiku routinely ends
    a field right after quoted material without closing punctuation even though
    the content is complete (stop_reason=end_turn) — repair it instead of
    discarding the summary as truncated. Only call when the model stopped on
    its own; a max_tokens cut must never be papered over."""
    if not text:
        return text
    text = text.rstrip()
    opens, closes = text.count("„"), text.count("”")
    if opens - closes == 1:
        text += "”"
    elif opens != closes:
        return text  # ambiguous quote state — leave untouched; _looks_cut decides
    if not text.endswith(_TERMINAL):
        text += "."
    return text


def _tidy_res(res: dict) -> dict:
    return {"ce_face": _tidy_field(res["ce_face"]),
            "motivare_initiatori": _tidy_field(res["motivare_initiatori"])}


def _overage(res: dict) -> int:
    ce = len(res["ce_face"].split())
    mot = len((res["motivare_initiatori"] or "").split())
    return max(0, ce - _CE_MAX) + max(0, mot - _MOT_MAX)


def _over_caps(res: dict) -> bool:
    return (len(res["ce_face"].split()) > _CE_MAX * 1.15
            or len((res["motivare_initiatori"] or "").split()) > _MOT_MAX * 1.15)


def _parse_result(raw: str) -> dict | None:
    """Model JSON → {'ce_face', 'motivare_initiatori'} or None (INDISPONIBIL/junk)."""
    try:
        item = json.loads(raw)
    except json.JSONDecodeError as e:
        log.warning("unparseable model JSON: %s", e)
        return None
    ce_face = _clean_field(str(item.get("ce_face") or ""))
    if not ce_face or ce_face.upper().startswith("INDISPONIBIL"):
        return None
    motivare = item.get("motivare_initiatori")
    motivare = _clean_field(str(motivare)) if isinstance(motivare, str) else None
    return {"ce_face": ce_face[:1200], "motivare_initiatori": (motivare or None) and motivare[:2000]}


def _doc_parts_gemini(fg_pdf: bytes | None, em_pdf: bytes | None) -> list[dict]:
    parts: list[dict] = []
    for kind, pdf in (("text", fg_pdf), ("em", em_pdf)):
        if pdf:
            parts.append({"text": _DOC_LABELS[kind]})
            parts.append({"inline_data": {"mime_type": "application/pdf",
                                          "data": base64.standard_b64encode(pdf).decode()}})
    return parts


def gemini_summary(api_key: str, fg_pdf: bytes | None, em_pdf: bytes | None,
                   title: str) -> dict | None:
    doc_parts = _doc_parts_gemini(fg_pdf, em_pdf)
    note = ""
    best: dict | None = None
    for attempt in range(2):
        parts = doc_parts + [{"text": PROMPT + note + f"\n\nTitlul oficial: {title}"}]
        body = {
            "contents": [{"parts": parts}],
            # thinkingBudget: 0 — 2.5 models think by default; the reasoning eats
            # the output budget and truncates the summary. Simple task, skip it.
            "generationConfig": {"temperature": 0, "maxOutputTokens": 1000,
                                 "responseMimeType": "application/json",
                                 "thinkingConfig": {"thinkingBudget": 0}},
        }
        # On a 429 (per-minute quota), wait for the window to reset and retry a
        # few times; only give up if it's persistent (daily quota exhausted).
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
            return None
        try:
            cand = r.json()["candidates"][0]
            raw = cand["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError):
            return None
        res = _parse_result(raw)
        if res is not None and cand.get("finishReason") != "MAX_TOKENS":
            res = _tidy_res(res)
        if res is None:
            if cand.get("finishReason") != "MAX_TOKENS":
                return None  # INDISPONIBIL/junk — a retry won't change it at temp 0
        elif cand.get("finishReason") != "MAX_TOKENS" and not _looks_cut(res):
            if not _over_caps(res):
                return res
            # complete but overlong — keep the shortest complete attempt as a
            # fallback so a stubborn model costs us length, never the summary
            if best is None or _overage(res) < _overage(best):
                best = res
        if attempt == 0:
            log.info("truncated/overlong output — retrying with brevity note")
            note = _RETRY_NOTE
    if best is not None:
        log.warning("still over word caps after retry — keeping shortest complete output")
        return best
    log.warning("output still truncated after retry — treating as unavailable")
    return None


# ── Haiku fallback ────────────────────────────────────────────────────────────
# Same prompt, same JSON contract, Anthropic Haiku instead of Gemini — used
# when every Gemini key is rate-limited so the run finishes instead of leaving
# laws unsummarized until the quota resets.
_HAIKU_MODEL = "claude-haiku-4-5"
_HAIKU_SCHEMA = {
    "type": "object",
    "properties": {
        "ce_face": {"type": "string"},
        "motivare_initiatori": {"anyOf": [{"type": "string"}, {"type": "null"}]},
    },
    "required": ["ce_face", "motivare_initiatori"],
    "additionalProperties": False,
}


def haiku_summary(client, fg_pdf: bytes | None, em_pdf: bytes | None,
                  title: str) -> dict | None:
    import anthropic

    doc_content: list[dict] = []
    for kind, pdf in (("text", fg_pdf), ("em", em_pdf)):
        if pdf:
            doc_content.append({"type": "text", "text": _DOC_LABELS[kind]})
            doc_content.append({"type": "document",
                                "source": {"type": "base64", "media_type": "application/pdf",
                                           "data": base64.standard_b64encode(pdf).decode()}})
    note = ""
    best: dict | None = None
    for attempt in range(2):
        content = doc_content + [{"type": "text",
                                  "text": PROMPT + note + f"\n\nTitlul oficial: {title}"}]
        try:
            resp = client.messages.create(
                model=_HAIKU_MODEL,
                max_tokens=1000,
                temperature=0,
                output_config={"format": {"type": "json_schema", "schema": _HAIKU_SCHEMA}},
                messages=[{"role": "user", "content": content}],
            )
        except anthropic.APIError as e:
            log.warning("haiku error: %s", e)
            return None
        if resp.stop_reason == "refusal":
            return None
        raw = next((b.text for b in resp.content if b.type == "text"), "")
        if not raw:
            return None
        res = _parse_result(raw)
        if res is not None and resp.stop_reason != "max_tokens":
            res = _tidy_res(res)
        if res is None:
            if resp.stop_reason != "max_tokens":
                return None  # INDISPONIBIL/junk — a retry won't change it at temp 0
        elif resp.stop_reason != "max_tokens" and not _looks_cut(res):
            if not _over_caps(res):
                return res
            if best is None or _overage(res) < _overage(best):
                best = res
        if attempt == 0:
            log.info("truncated/overlong haiku output — retrying with brevity note")
            note = _RETRY_NOTE
    if best is not None:
        log.warning("haiku still over word caps after retry — keeping shortest complete output")
        return best
    log.warning("haiku output still truncated after retry — treating as unavailable")
    return None


class Store:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def laws_to_process(self, limit: int, only: str | None) -> list[dict]:
        params = {"select": "id,code,title", "order": "code.desc", "limit": str(limit)}
        if only:
            params = {"select": "id,code,title", "code": f"eq.{only}", "limit": "1"}
        else:
            params["summary"] = "is.null"
            params["summary_checked_at"] = "is.null"
            params["code"] = "like.L*"
        r = requests.get(f"{self.url}/rest/v1/laws", params=params, headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()

    def save(self, law_id: str, res: dict | None, em_url: str | None,
             bill_pdf_url: str | None, source: str) -> None:
        payload: dict = {
            "summary": res["ce_face"] if res else None,
            "motivare_initiatori": res["motivare_initiatori"] if res else None,
            "summary_source": source if res else None,
            "summary_is_ai": res is not None,
            "summary_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        if em_url:
            payload["em_url"] = em_url
        if bill_pdf_url:
            payload["bill_pdf_url"] = bill_pdf_url
        r = requests.patch(f"{self.url}/rest/v1/laws", params={"id": f"eq.{law_id}"},
                          headers={**self.h, "Content-Type": "application/json"},
                          json=payload, timeout=30)
        r.raise_for_status()


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Structured two-part law summaries via Gemini")
    ap.add_argument("--limit", type=int, default=500, help="max laws this run")
    ap.add_argument("--redo", metavar="CODE", help="re-summarize one law by code")
    ap.add_argument("--dry-run", action="store_true", help="print, don't write")
    args = ap.parse_args()

    # GEMINI_API_KEY may hold several comma-separated keys; when one exhausts its
    # daily quota we rotate to the next (each free key has its own allowance).
    keys = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not keys:
        log.info("GEMINI_API_KEY not set — skipping (summaries stay link-only)")
        return
    if not (url and key):
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    haiku = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        haiku = anthropic.Anthropic()

    ki = 0
    store = Store(url, key)
    laws = store.laws_to_process(args.limit, args.redo)
    log.info("%d law(s) to process (%d key%s)", len(laws), len(keys), "s" if len(keys) > 1 else "")
    done = ok = 0
    for law in laws:
        title = law.get("title") or law["code"]
        em, fg = em_url_for(law["code"]), fg_url_for(law["code"])
        em_pdf, fg_pdf = fetch_pdf(em), fetch_pdf(fg)
        source = summary_source_for(fg_pdf, em_pdf)
        # Try current key; on persistent 429 rotate to the next key. When every
        # key is exhausted, finish the run on Haiku (if configured) — otherwise
        # stop cleanly and let the next run resume.
        res = None
        if haiku is not None and ki >= len(keys):
            res = haiku_summary(haiku, fg_pdf, em_pdf, title)
        else:
            exhausted = False
            while True:
                try:
                    res = gemini_summary(keys[ki], fg_pdf, em_pdf, title)
                    break
                except RateLimited as e:
                    if ki + 1 < len(keys):
                        ki += 1
                        log.info("key %d exhausted — switching to key %d", ki, ki + 1)
                        continue
                    ki = len(keys)
                    if haiku is not None:
                        log.info("all Gemini keys rate-limited — continuing with %s", _HAIKU_MODEL)
                        res = haiku_summary(haiku, fg_pdf, em_pdf, title)
                        break
                    log.warning("all keys rate limited — stopping cleanly, next run resumes (%s)", e)
                    exhausted = True
                    break
            if exhausted:
                break
        done += 1
        if res:
            ok += 1
            log.info("%s [%s]: %s", law["code"], source, res["ce_face"][:90])
        else:
            log.info("%s: INDISPONIBIL", law["code"])
        if not args.dry_run:
            store.save(law["id"], res, em if em_pdf else None, fg if fg_pdf else None, source)
        time.sleep(_DELAY)

    log.info("done: %d processed, %d summarized%s", done, ok, " (dry-run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
