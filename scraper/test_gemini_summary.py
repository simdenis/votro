"""One-off: summarize N law "expunere de motive" PDFs with Gemini (free tier).

Sends each PDF to Gemini natively (multimodal) — no local PDF text extraction,
so it sidesteps the garbled-OCR problem that made the extractive summarizer
produce nothing. Saves results to scratchpad for a human/Claude cross-check;
does NOT write to the DB (this is an evaluation run).

Env: GEMINI_API_KEY (free from aistudio.google.com), SUPABASE_URL, SUPABASE_KEY.
Usage: python test_gemini_summary.py [N]   (default 10)
"""
from __future__ import annotations

import base64
import json
import os
import re
import sys

import requests
from dotenv import load_dotenv

CODE_RE = re.compile(r"^L(\d+)/(\d{4})$")
MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
OUT_DIR = "/private/tmp/claude-502/-Users-simdenis-Desktop-romanian-politics-frontend/b0af3e22-4c00-4faa-9570-6493b696c9e0/scratchpad"

PROMPT = (
    "Documentul atașat este expunerea de motive a unui proiect de lege românesc. "
    "Explică pe scurt, pentru un cetățean obișnuit fără studii juridice, CE SCHIMBĂ "
    "acest proiect și de ce contează pentru oameni. Reguli:\n"
    "- limbaj simplu, de zi cu zi; evită jargonul juridic\n"
    "- NU cita numere de articole, directive sau legi (ex. „art. 281”, „Directiva "
    "2006/112/CE”); spune în cuvinte ce înseamnă\n"
    "- 1-2 fraze scurte, maximum ~50 de cuvinte\n"
    "- folosește STRICT informația din document; nu inventa, nu adăuga opinii\n"
    "Dacă documentul e ilizibil sau nu e o expunere de motive, răspunde exact: "
    "INDISPONIBIL. Răspunde doar cu explicația, fără preambul."
)


def em_url_for(code: str) -> str | None:
    m = CODE_RE.match(code.strip())
    if not m:
        return None
    num, year = int(m.group(1)), int(m.group(2))
    return f"https://www.senat.ro/legis/PDF/{year}/{year % 100:02d}L{num:03d}EM.PDF"


def fetch_laws(url: str, key: str, limit: int) -> list[dict]:
    r = requests.get(
        f"{url}/rest/v1/laws",
        params={"select": "code,title", "summary": "is.null", "title": "not.is.null",
                "code": "like.L*", "order": "code.desc", "limit": str(limit * 4)},
        headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=30,
    )
    r.raise_for_status()
    return r.json()


def gemini_summary(api_key: str, pdf_bytes: bytes) -> str:
    body = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": "application/pdf",
                             "data": base64.standard_b64encode(pdf_bytes).decode()}},
            {"text": PROMPT},
        ]}],
        # thinkingBudget: 0 — 2.5 models think by default and the reasoning eats
        # the output budget, truncating the summary. This is a simple task; skip it.
        "generationConfig": {"temperature": 0, "maxOutputTokens": 500,
                             "thinkingConfig": {"thinkingBudget": 0}},
    }
    r = requests.post(GEMINI_URL, params={"key": api_key}, json=body, timeout=90)
    if not r.ok:
        return f"[GEMINI ERROR {r.status_code}: {r.text[:200]}]"
    try:
        return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        return f"[GEMINI NO OUTPUT: {json.dumps(r.json())[:200]}]"


def main() -> None:
    load_dotenv()
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    api_key = os.environ.get("GEMINI_API_KEY", "")
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not api_key:
        sys.exit("ERROR: GEMINI_API_KEY not set (get one free at https://aistudio.google.com/apikey)")
    if not (url and key):
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")

    os.makedirs(OUT_DIR, exist_ok=True)
    results, done = [], 0
    for law in fetch_laws(url, key, n):
        if done >= n:
            break
        em = em_url_for(law["code"])
        if not em:
            continue
        try:
            pdf = requests.get(em, timeout=40, headers={"User-Agent": "Mozilla/5.0"})
        except requests.RequestException:
            continue
        if not pdf.ok or pdf.headers.get("content-type", "").lower().find("pdf") < 0 or len(pdf.content) < 1000:
            continue  # no EM PDF for this bill
        pdf_path = os.path.join(OUT_DIR, f"em_{law['code'].replace('/', '_')}.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf.content)
        summary = gemini_summary(api_key, pdf.content)
        done += 1
        print(f"[{done}/{n}] {law['code']}: {summary[:80]}")
        results.append({"code": law["code"], "title": law["title"],
                        "pdf_path": pdf_path, "pdf_bytes": len(pdf.content), "summary": summary})

    out = os.path.join(OUT_DIR, "gemini_results.json")
    with open(out, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nSaved {len(results)} results → {out}")


if __name__ == "__main__":
    main()
