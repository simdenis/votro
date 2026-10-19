"""Plain-language explainers for laws: what concretely changes, for whom, from when.

laws.summary (gemini_summarizer) describes the bill mechanically — «abrogă
literele i)–k) din art. 88» — which tells a reader nothing. The explainer reads
the FINAL text (the promulgated form, not the initiator's draft Parliament may
have amended) and says what the rule was and what it is now:

  {"titlu": "...", "rezumat": "...", "ce_se_schimba": [{"inainte": ..., "acum": ...}],
   "pe_cine_afecteaza": "...", "de_cand": ..., "neclar": ...}

«titlu» + «rezumat» are what the page shows; the rest sits under «Detalii».

Neutrality: «titlu» and «acum» come ONLY from the law text. The expunere de
motive is the initiators' document about their draft — it may explain what the
old rule was, never what the law does.

Documents from senat.ro (same L-number pattern as the summarizer): FP forma
promulgată → LP forma trimisă la promulgare → FS forma adoptată de Senat → FG
forma inițiatorului, plus EM. explainer_source records which text was read.

Usage:
    python law_explainer.py [--limit N] [--code L469/2026] [--force] [--dry-run] [--out file.jsonl]
Default scope: promulgated laws, then laws passed by both chambers (at the President or returned), without an explainer.
Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import io
import json
import logging
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv

import gemini_summarizer as g

log = logging.getLogger("law-explainer")
MODEL = os.environ.get("EXPLAINER_MODEL", "claude-sonnet-5-5")
MAX_BYTES = 24_000_000  # base64 adds a third: 24 MB of PDF ≈ 32 MB on the wire
MAX_PAGES = 60  # one request: ≤100 PDF pages and ≤200k tokens; scanned senat.ro pages ~3k tokens

TEXT_FORMS = [("FP", "fp"), ("LP", "lp"), ("FS", "fs"), ("FG", "fg")]
TEXT_LABEL = {"fp": "forma promulgată", "lp": "forma trimisă la promulgare", "fs": "forma adoptată de Senat", "fg": "forma inițiatorului"}

PROMPT = (
    "Primești documentele oficiale ale unei legi românești: [1] textul legii ({form}) și, dacă există, "
    "[2] expunerea de motive scrisă de inițiatori pentru propunerea inițială. Scrie o EXPLICAȚIE pentru un "
    "cetățean fără studii juridice: ce se schimbă concret în viața cuiva. Răspunde STRICT cu JSON după schemă.\n\n"
    "SURSE — regula de neutralitate:\n"
    "- «titlu» și «acum» descriu DOAR ce scrie în textul legii [1]. Nimic din ele nu se poate sprijini doar pe [2].\n"
    "- [2] e scrisă de inițiatori și poate descrie o formă pe care Parlamentul a modificat-o. Folosește-o doar ca să "
    "înțelegi ce spunea regula veche («inainte») sau ce reglementau articolele modificate. Nu prelua din ea scopuri, "
    "beneficii, cifre sau pedepse care nu apar în [1].\n"
    "- Dacă [2] afirmă ceva ce nu se regăsește în [1], nu-l scrie; menționează în «neclar» doar dacă e esențial.\n\n"
    "TITLU — maximum 10 cuvinte: cine + ce poate / trebuie / nu mai poate face. Concret, despre oameni, nu despre lege.\n"
    "- INTERZIS să înceapă cu: Schimbări, Modificări, Reguli noi, Noi reguli, Lege nouă, Legea, Proiectul\n"
    "- INTERZIS orice evaluare: «mai bine», «mai multă protecție», «în sfârșit», «important», «controversat»\n"
    "- bun: «Consilierii locali pot fi și consilieri ai primarului»; rău: «Schimbări la legea anticorupție»\n"
    "- titlul nu poate afirma ce «neclar» spune că nu reiese din documente (de ex. cine anume e vizat)\n"
    "- o singură propoziție, FĂRĂ două puncte (nu «Elevii: admiterea fără concurs», ci «Elevii intră la liceu fără concurs»)\n"
    "- legea aprobă o ordonanță (OG/OUG)? Titlul spune ce face ORDONANȚA pentru oameni, nu «Parlamentul aprobă/confirmă "
    "ordonanța» (bun: «Fermierii afectați de secetă primesc ajutor de stat»). În rezumat spui că ordonanța era deja în "
    "vigoare și ce a schimbat Parlamentul la ea, dacă a schimbat ceva.\n\n"
    "REZUMAT — ce vede omul obișnuit: 2–3 propoziții scurte, STRICT maximum 60 de cuvinte în total. Spune ce se "
    "schimbă concret în viața cuiva, ca și cum i-ai explica unui vecin: cine, ce poate / trebuie / primește, cât, de "
    "când. Cifrele și termenele concrete din lege sunt binevenite. FĂRĂ numere de articole, alineate sau litere, fără "
    "«prezenta lege», «se abrogă», «se modifică», fără jargon («prorogare» → «amânare», «degrevare» → «scutire»). "
    "Nu repeta titlul.\n\n"
    "CE_SE_SCHIMBA — 1–3 schimbări, cele care contează cel mai mult pentru oameni, fiecare ca efect, nu ca trimitere "
    "la articol. «acum» = regula nouă în cuvinte simple (cine, ce, cât, până când). «inainte» = regula veche, DOAR dacă "
    "reiese din documente, altfel null. Nu scrie «se abrogă litera i)» — scrie ce spunea litera i) și ce dispare. "
    "Maximum 35 de cuvinte pe câmp.\n\n"
    "PE_CINE_AFECTEAZA — o frază: grupul concret de oameni sau instituții.\n"
    "DE_CAND — doar dacă textul legii spune (o dată, un termen); altfel null.\n"
    "NECLAR — ce nu se poate explica din documente (o regulă lăsată pe seama unui ordin, o trimitere la un articol "
    "necitat), pe scurt; altfel null.\n\n"
    "Fiecare afirmație trebuie să se poată verifica în documente. Limbaj simplu, neutru, propoziții scurte, "
    "diacritice corecte (ș ț cu virgulă), fără markdown. Scrie ca un jurnalist, nu ca un asistent: FĂRĂ cratimă "
    "lungă (—), fără punct și virgulă, fără construcții de tipul «nu doar X, ci Y» sau «nu e X, e Y», fără "
    "enumerări de trei adjective, fără cuvinte goale («esențial», «important», «semnificativ», «modern»)."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "titlu": {"type": "string"},
        "rezumat": {"type": "string"},
        "ce_se_schimba": {"type": "array", "items": {
            "type": "object",
            "properties": {"inainte": {"type": ["string", "null"]}, "acum": {"type": "string"}},
            "required": ["inainte", "acum"], "additionalProperties": False}},
        "pe_cine_afecteaza": {"type": "string"},
        "de_cand": {"type": ["string", "null"]},
        "neclar": {"type": ["string", "null"]},
    },
    "required": ["titlu", "rezumat", "ce_se_schimba", "pe_cine_afecteaza", "de_cand", "neclar"],
    "additionalProperties": False,
}

BANNED_OPENERS = ("Schimbări", "Modificări", "Reguli noi", "Noi reguli", "Lege nouă", "Legea", "Proiectul")


def senat_pdf(code: str, suffix: str) -> str | None:
    m = g.CODE_RE.match(code.strip())
    if not m:
        return None
    num, year = int(m.group(1)), int(m.group(2))
    return f"https://www.senat.ro/legis/PDF/{year}/{year % 100:02d}L{num:03d}{suffix}.PDF"


def first_pages(pdf: bytes, n: int) -> bytes:
    import pypdf
    reader, writer = pypdf.PdfReader(io.BytesIO(pdf)), pypdf.PdfWriter()
    for p in reader.pages[:n]:
        writer.add_page(p)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def documents(code: str) -> tuple[str | None, bytes | None, bytes | None]:
    """(text form, final text pdf, EM pdf), trimmed to one request. The law text
    has priority: the EM is dropped first, then the text is cut to its first pages."""
    form, text = None, None
    for suffix, name in TEXT_FORMS:
        text = g.fetch_pdf(senat_pdf(code, suffix))
        if text:
            form = name
            break
    em = g.fetch_pdf(g.em_url_for(code))
    tn, en = g.pdf_pages(text), g.pdf_pages(em)
    if tn + en > MAX_PAGES:
        if tn <= MAX_PAGES:
            log.info("%s: %dp text + %dp EM — dropping the EM", code, tn, en)
            em = None
        elif text:
            log.info("%s: %dp text — keeping its first %d pages", code, tn, MAX_PAGES)
            text, em = first_pages(text, MAX_PAGES), None
    # bytes, not just pages: scanned EMs run 30-45 MB (the API takes ≤32 MB per PDF
    # and ≤32 MB per request). The EM goes first; the law text is cut to fewer pages.
    if em and len(em) + len(text or b"") > MAX_BYTES:
        log.info("%s: EM is %d MB — dropping it", code, len(em) // 1_000_000)
        em = None
    for pages in (30, 15, 8):
        if not text or len(text) <= MAX_BYTES:
            break
        log.info("%s: text is %d MB — keeping its first %d pages", code, len(text) // 1_000_000, pages)
        text = first_pages(text, pages)
    return form, text, em


def build_request(code: str, title: str) -> tuple[dict, str] | None:
    """Messages params for one law + the explainer_source it will record; None when senat.ro has no text."""
    form, text, em = documents(code)
    if not text:
        log.warning("%s: no law text on senat.ro — skipped", code)
        return None
    content = [{"type": "text", "text": f"Documentul [1] — textul legii ({TEXT_LABEL[form]}):"},
               {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                               "data": base64.standard_b64encode(text).decode()}}]
    if em:
        content += [{"type": "text", "text": "Documentul [2] — expunerea de motive (a inițiatorilor):"},
                     {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                                     "data": base64.standard_b64encode(em).decode()}}]
    content.append({"type": "text", "text": PROMPT.format(form=TEXT_LABEL[form]) + f"\n\nTitlul oficial: {title}"})
    params = {"model": MODEL, "max_tokens": 16000,
              "output_config": {"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
              "messages": [{"role": "user", "content": content}]}
    return params, form + ("+em" if em else "")


def _plain(t: str | None) -> str | None:
    """Belt and braces for the prompt's style rules: no em dashes, no semicolons."""
    if t is None:
        return None
    t = re.sub(r"\s*—\s*|\s+–\s+", ", ", t.strip())          # spaced en dash = em dash; 2025–2026 stays
    t = re.sub(r"\s*;\s*(\w)", lambda m: ". " + m.group(1).upper(), t)
    return t.replace(",,", ",")


def parse(code: str, message, source: str) -> dict | None:
    if message.stop_reason == "refusal":
        log.warning("%s: refused", code)
        return None
    data = json.loads(next(b.text for b in message.content if b.type == "text"))
    for k in ("titlu", "rezumat", "pe_cine_afecteaza", "de_cand", "neclar"):
        data[k] = _plain(data.get(k))
    data["ce_se_schimba"] = [{"inainte": _plain(c.get("inainte")), "acum": _plain(c["acum"])} for c in data["ce_se_schimba"]]
    data["titlu"] = data["titlu"].rstrip(".")
    if data["titlu"].startswith(BANNED_OPENERS) or ":" in data["titlu"] or not data["ce_se_schimba"]:
        log.warning("%s: off-spec answer (%r) — skipped", code, data["titlu"])
        return None
    return {"explainer": data, "explainer_source": source, "explainer_model": MODEL,
            "explainer_checked_at": dt.datetime.now(dt.timezone.utc).isoformat()}


def explain(client, code: str, title: str) -> dict | None:
    built = build_request(code, title)
    if not built:
        return None
    params, source = built
    r = client.beta.messages.create(**params, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    return parse(code, r, source)


class Sink:
    """Where results go: the DB (unless --dry-run) and an optional .jsonl."""

    def __init__(self, args, U: str, H: dict):
        self.args, self.U, self.H, self.done = args, U, H, 0

    def write(self, law: dict, res: dict) -> None:
        if self.args.out:
            with open(self.args.out, "a", encoding="utf-8") as f:
                f.write(json.dumps({"code": law["code"], **res}, ensure_ascii=False) + "\n")
        if not self.args.dry_run:
            requests.patch(f"{self.U}/rest/v1/laws", params={"id": f"eq.{law['id']}"}, json=res,
                           headers={**self.H, "Prefer": "return=minimal"}, timeout=30).raise_for_status()
        self.done += 1
        log.info("%s → %s", law["code"], res["explainer"]["titlu"])


def run_batch(client, laws: list[dict], sink: Sink, chunk: int) -> None:
    """Message Batches API: half the price, results within hours. Every chunk is
    submitted first (each batch carries its PDFs, so one stays under the 256 MB
    cap), then all of them are collected — the chunks run in parallel."""
    by_id = {law["id"]: law for law in laws}
    sources: dict[str, str] = {}
    batch_ids: list[str] = []
    for i in range(0, len(laws), chunk):
        reqs = []
        for law in laws[i:i + chunk]:
            built = build_request(law["code"], law["title"])
            if built:
                reqs.append({"custom_id": law["id"], "params": built[0]})
                sources[law["id"]] = built[1]
        if reqs:
            batch = client.messages.batches.create(requests=reqs)
            batch_ids.append(batch.id)
            log.info("batch %s: %d law(s) submitted", batch.id, len(reqs))
    pending = list(batch_ids)
    while pending:
        time.sleep(60)
        for bid in list(pending):
            if client.messages.batches.retrieve(bid).processing_status != "ended":
                continue
            pending.remove(bid)
            for item in client.messages.batches.results(bid):
                law = by_id[item.custom_id]
                if item.result.type != "succeeded":
                    log.warning("%s: batch result %s", law["code"], item.result.type)
                    continue
                try:
                    res = parse(law["code"], item.result.message, sources[item.custom_id])
                except Exception as e:
                    log.warning("%s: %s: %s", law["code"], type(e).__name__, str(e)[:200])
                    continue
                if res:
                    sink.write(law, res)
            log.info("batch %s collected · %d batch(es) left", bid, len(pending))


def main() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    for noisy in ("httpx", "httpcore", "anthropic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--code", action="append", help="only these law codes (repeatable)")
    ap.add_argument("--force", action="store_true", help="redo laws that already have an explainer")
    ap.add_argument("--dry-run", action="store_true", help="don't write to the DB")
    ap.add_argument("--out", help="also append every result to this .jsonl")
    ap.add_argument("--batch", action="store_true", help="use the Message Batches API (half price, slower)")
    ap.add_argument("--chunk", type=int, default=100, help="laws per batch")
    args = ap.parse_args()

    import anthropic
    client = anthropic.Anthropic(timeout=300)
    U, K = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_KEY"]
    H = {"apikey": K, "Authorization": f"Bearer {K}"}

    q = {"select": "id,code,title", "code": "like.L*", "order": "presidential_date.desc.nullslast", "limit": str(args.limit)}
    if args.code:
        q["code"] = f"in.({','.join(args.code)})"
    else:
        q["presidential_status"] = "eq.promulgat"
        if not args.force:
            q["explainer"] = "is.null"
    laws = requests.get(f"{U}/rest/v1/laws", params=q, headers=H, timeout=30).json()
    if not args.code:
        # also every law Parliament passed (both chambers, now with the President or
        # returned): those are posted too, and the LP form is their final text
        both = requests.get(f"{U}/rest/v1/law_status", headers=H, timeout=30, params={
            "select": "law_id", "senate_outcome": "eq.adoptat", "camera_outcome": "eq.adoptat",
            "presidential_status": "not.eq.promulgat", "code": "like.L*", "limit": "1000"}).json()
        have = {l["id"] for l in laws}
        extra = [r["law_id"] for r in both if r["law_id"] not in have]
        for i in range(0, len(extra), 80):
            more = requests.get(f"{U}/rest/v1/laws", headers=H, timeout=30, params={
                "select": "id,code,title", "id": f"in.({','.join(extra[i:i + 80])})",
                **({} if args.force else {"explainer": "is.null"})}).json()
            laws += more
        laws = laws[:args.limit]
    log.info("%d law(s) to explain with %s%s", len(laws), MODEL, " (batch)" if args.batch else "")

    sink = Sink(args, U, H)
    if args.batch:
        run_batch(client, laws, sink, args.chunk)
    else:
        for law in laws:
            try:
                res = explain(client, law["code"], law["title"])
            except Exception as e:  # one bad law must not stop the run
                log.warning("%s: %s: %s", law["code"], type(e).__name__, str(e)[:200])
                continue
            if res:
                sink.write(law, res)
    log.info("explained %d/%d", sink.done, len(laws))

if __name__ == "__main__":
    sys.exit(main())
