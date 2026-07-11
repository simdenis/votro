"""Who proposed each law — initiators from the senat.ro project fisa.

The fisa at lista.aspx?nr_cls=L{n}&an_cls={year} carries a
`lista-legis-table-initiatori-container` block that is either
"Guvernul României", a citizens' initiative, or a nominal list in the form
"Nume Prenume - senator PARTID; ...". Writes laws.initiator_type
(guvern / parlamentari / cetateni) and one law_initiators row per named
parliamentarian, matched to politicians via diacritic-folded token sets
(politicians.search_name), chamber-scoped by the printed role. Unmatched
names keep their raw string — ex-members and typos must not vanish.

senat.ro quirks handled: retry-with-backoff on flaky/empty responses; a page
without the initiator container is retried once, then stamped checked so we
don't hammer it forever. Only L-registry laws have a fisa (PHCD/PH hotărâri
are internal chamber business with no initiator concept).

Env: SUPABASE_URL, SUPABASE_KEY.
Usage:
    python initiator_scraper.py [--limit N] [--redo CODE] [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime
import logging
import os
import re
import time
import unicodedata

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("initiators")

FISA_URL = "https://www.senat.ro/legis/lista.aspx"
CODE_RE = re.compile(r"^(L\d+)/(\d{4})$")
CONTAINER_MARK = "lista-legis-table-initiatori-container"
ENTRY_RE = re.compile(r"^(.*?)\s*-\s*(senator|deputat)\b\.?\s*(.*)$", re.I)
UA = {"User-Agent": "VotRO/1.0 Romanian parliamentary vote tracker (research; contact: siminiucdenis@gmail.com)"}
_DELAY = 1.5


def fold(s: str) -> str:
    """lowercase, diacritics stripped — same normalization as search_name."""
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def tokens(s: str) -> frozenset[str]:
    return frozenset(t for t in re.split(r"[\s\-.,]+", fold(s)) if t)


def strip_tags(html: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", html)
    txt = txt.replace("&#259;", "ă").replace("&#226;", "â").replace("&#238;", "î")
    txt = txt.replace("&#351;", "ş").replace("&#355;", "ţ").replace("&amp;", "&").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", txt).strip()


def fetch_fisa(session: requests.Session, num: str, year: str) -> str | None:
    """Fisa HTML, retried — senat.ro intermittently serves empty/broken pages."""
    for attempt in range(3):
        try:
            r = session.get(FISA_URL, params={"nr_cls": num, "an_cls": year}, timeout=40)
            r.raise_for_status()
            r.encoding = "utf-8"
            # sanity: a real fisa mentions its own code and is not a bare form
            if len(r.text) > 60_000 and f"{num}/{year}" in r.text:
                return r.text
            log.info("%s/%s: thin/foreign response (%d bytes), retry %d", num, year, len(r.text), attempt + 1)
        except requests.RequestException as exc:
            log.info("%s/%s: network error (%s), retry %d", num, year, exc, attempt + 1)
        time.sleep(3 * (attempt + 1))
    return None


def parse_initiators(html: str) -> tuple[str, list[dict]] | None:
    """(initiator_type, [{name_raw, role_raw, party_raw}]) or None when absent."""
    i = html.find(CONTAINER_MARK)
    if i < 0:
        return None
    body = strip_tags(html[i : i + 12_000])
    # text after the "Inițiatori:" label, cut at the next fisa row
    lm = re.search(r"Ini[țţt]iatori?\s*:", body)
    if not lm:
        return None
    body = body[lm.end():]
    body = re.split(r"Trimis la|Num[ăa]r d|L\d+/\d{4}|Adoptat|Respins", body)[0].strip().strip(";").strip()
    if not body:
        return None
    low = fold(body)
    if "guvernul" in low:
        return "guvern", []
    if "cetat" in low:  # cetățeni / cetăţeni
        return "cetateni", []

    people: list[dict] = []
    for raw in body.split(";"):
        raw = raw.strip().rstrip(".")
        if not raw:
            continue
        em = ENTRY_RE.match(raw)
        if em:
            people.append({
                "name_raw": em.group(1).strip(),
                "role_raw": em.group(2).lower(),
                "party_raw": (em.group(3) or "").strip() or None,
            })
        else:
            people.append({"name_raw": raw, "role_raw": None, "party_raw": None})
    return ("parlamentari", people) if people else None


class Store:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}
        self.jh = {**self.h, "Content-Type": "application/json"}

    def laws_to_process(self, limit: int, only: str | None) -> list[dict]:
        params = {"select": "id,code", "order": "code.desc", "limit": str(limit), "code": "like.L*"}
        if only:
            params = {"select": "id,code", "code": f"eq.{only}", "limit": "1"}
        else:
            params["initiators_checked_at"] = "is.null"
        r = requests.get(f"{self.url}/rest/v1/laws", params=params, headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()

    def politicians(self) -> list[dict]:
        r = requests.get(f"{self.url}/rest/v1/politicians",
                         params={"select": "id,search_name,chamber", "limit": "2000"},
                         headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()

    def save(self, law_id: str, itype: str | None, people: list[dict]) -> None:
        r = requests.patch(f"{self.url}/rest/v1/laws", params={"id": f"eq.{law_id}"},
                           headers=self.jh, json={
                               "initiator_type": itype,
                               "initiators_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                           }, timeout=30)
        r.raise_for_status()
        if people:
            r = requests.post(f"{self.url}/rest/v1/law_initiators",
                              params={"on_conflict": "law_id,name_raw"},
                              headers={**self.jh, "Prefer": "resolution=merge-duplicates"},
                              json=[{"law_id": law_id, **p} for p in people], timeout=30)
            r.raise_for_status()


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Law initiators from senat.ro fisa")
    ap.add_argument("--limit", type=int, default=600)
    ap.add_argument("--redo", metavar="CODE")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_KEY must be set")
    store = Store(url, key)

    # name → politician lookup: token set of search_name, per chamber
    by_tokens: dict[tuple[str, frozenset[str]], str] = {}
    ambiguous: set[tuple[str, frozenset[str]]] = set()
    for p in store.politicians():
        keyt = (p["chamber"], tokens(p["search_name"] or ""))
        if keyt in by_tokens:
            ambiguous.add(keyt)
        by_tokens[keyt] = p["id"]

    def match(name: str, role: str | None) -> str | None:
        t = tokens(name)
        chambers = {"senator": ["senate"], "deputat": ["deputies"]}.get(role or "", ["senate", "deputies"])
        for ch in chambers:
            keyt = (ch, t)
            if keyt in by_tokens and keyt not in ambiguous:
                return by_tokens[keyt]
        return None

    laws = store.laws_to_process(args.limit, args.redo)
    if not laws:
        log.info("nothing to process")
        return
    log.info("processing %d laws", len(laws))

    session = requests.Session()
    session.headers.update(UA)
    done = matched = named = failed = 0
    for law in laws:
        cm = CODE_RE.match(law["code"])
        if not cm:
            continue
        num, year = cm.group(1), cm.group(2)
        html = fetch_fisa(session, num, year)
        if html is None:
            failed += 1
            log.warning("%s: fisa unreachable — will retry next run", law["code"])
            continue

        parsed = parse_initiators(html)
        itype, people = parsed if parsed else (None, [])
        for p in people:
            p["politician_id"] = match(p["name_raw"], p["role_raw"])
            named += 1
            matched += 1 if p["politician_id"] else 0

        if args.dry_run:
            print(f"{law['code']}: {itype}  " + "; ".join(
                f"{p['name_raw']} ({p['party_raw'] or '?'}){'*' if not p['politician_id'] else ''}" for p in people[:6])
                + (f" +{len(people) - 6}" if len(people) > 6 else ""))
        else:
            store.save(law["id"], itype, people)
        done += 1
        time.sleep(_DELAY)

    log.info("done: %d laws, %d names (%d matched to politicians), %d unreachable",
             done, named, matched, failed)


if __name__ == "__main__":
    main()
