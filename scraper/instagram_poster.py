"""Publish VotRO posts to Instagram via the Instagram API (Instagram Login).

This is the publishing pipeline only — it never runs automatically. You invoke
it explicitly (CLI below) once you have set the credentials. The post image is
served by the Next.js route `/api/og/post?vote=<id>` (public URL on Vercel),
which the API fetches when creating the media container.

Required environment (in scraper/.env or the shell):
    SUPABASE_URL, SUPABASE_KEY      already used by the scrapers
    SITE_URL                        e.g. https://votro.ro (no trailing slash)
    IG_USER_ID                      Instagram professional account id
    IG_ACCESS_TOKEN                 long-lived Instagram User token with
                                    instagram_business_basic +
                                    instagram_business_content_publish
    IG_APP_SECRET                   only for --exchange-token
    GRAPH_API_VERSION               optional, defaults to v21.0

Flow (Content Publishing, host graph.instagram.com):
    1. POST /{ig-user-id}/media          -> creation_id  (container)
    2. GET  /{creation_id}?fields=status_code  -> poll until FINISHED
    3. POST /{ig-user-id}/media_publish  -> media_id     (goes live)

Usage:
    python instagram_poster.py --exchange-token <short>  # short-lived -> 60-day token
    python instagram_poster.py --refresh-token          # extend the current token 60 days
    python instagram_poster.py --verify                 # check the token
    python instagram_poster.py --vote <vote_id>         # build + publish a vote post
    python instagram_poster.py --law <law_id>           # standard law carousel
    python instagram_poster.py --shame                  # shame-corner card (top absentees)
    python instagram_poster.py --shame --email-preview  # email last month's card for approval
                                                        # (to $IG_PREVIEW_EMAIL; never publishes)
    python instagram_poster.py --carousel <url> <url> … --caption "..."  # any carousel
    python instagram_poster.py --vote <vote_id> --dry-run   # print, do not publish
    python instagram_poster.py --image-url <url> --caption "..."   # post anything
"""
from __future__ import annotations

import argparse
import base64 as _b64
import datetime as _dt
import hashlib
import html as _html
import hmac as _hmac
import json
import os
import sys
import time
from urllib.parse import quote as _quote

import requests
from dotenv import load_dotenv

RO_MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
             "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]

GRAPH = "https://graph.instagram.com"
_TIMEOUT = 30

# Cards with the seat-arc hemicycle (lawcard/tacitcard/votecard) exceed the
# Cloudflare Free plan's 10ms CPU cap and 503 when Instagram tries to fetch
# them. The --static path renders those slides offline (frontend/scripts/
# render-ig.mjs, no CPU cap) into frontend/public/ig/<name>, deployed as static
# assets served at {SITE_URL}/ig/<name> — Instagram then fetches a plain file.
STATIC_SUBDIR = "ig"


def _slide_name(suffix: str) -> str:
    """Deterministic static filename for an og-card suffix. This is the contract
    shared between the offline renderer (writes public/ig/<name>) and --static
    posting (fetches {SITE_URL}/ig/<name>) — both derive it from the same suffix."""
    return "s-" + hashlib.sha1(suffix.encode()).hexdigest()[:16] + ".png"


def _slide_url(cfg: "Config", suffix: str, static: bool) -> str:
    """Map an og-card suffix ('og/lawcard?id=…') to a fetchable URL: the dynamic
    /api route, or the pre-rendered static file when --static."""
    if static:
        return f"{cfg.site_url}/{STATIC_SUBDIR}/{_slide_name(suffix)}"
    return f"{cfg.site_url}/api/{suffix}"


# ── Config ──────────────────────────────────────────────────────────────────
class Config:
    def __init__(self) -> None:
        self.supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.supabase_key = os.environ.get("SUPABASE_KEY", "")
        self.site_url     = os.environ.get("SITE_URL", "https://votro.ro").rstrip("/")
        self.ig_user_id   = os.environ.get("IG_USER_ID", "")
        self.token        = os.environ.get("IG_ACCESS_TOKEN", "")
        self.app_secret   = os.environ.get("IG_APP_SECRET", "")
        self.version      = os.environ.get("GRAPH_API_VERSION", "v21.0")

    def require_publishing(self) -> None:
        missing = [k for k, v in {
            "IG_USER_ID": self.ig_user_id,
            "IG_ACCESS_TOKEN": self.token,
        }.items() if not v]
        if missing:
            sys.exit(f"ERROR: missing env var(s): {', '.join(missing)}")

    def require_supabase(self) -> None:
        if not (self.supabase_url and self.supabase_key):
            sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set.")


# ── Supabase helpers (caption data) ──────────────────────────────────────────
def _sb_get(cfg: Config, table: str, params: dict) -> list[dict]:
    r = requests.get(
        f"{cfg.supabase_url}/rest/v1/{table}",
        params=params,
        headers={"apikey": cfg.supabase_key, "Authorization": f"Bearer {cfg.supabase_key}"},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def fetch_vote(cfg: Config, vote_id: str) -> dict | None:
    rows = _sb_get(cfg, "votes", {"id": f"eq.{vote_id}", "select": "*,laws(*)", "limit": "1"})
    return rows[0] if rows else None


# ── Caption builder ───────────────────────────────────────────────────────────
def build_vote_caption(cfg: Config, vote: dict) -> str:
    law = vote.get("laws") or {}
    code = law.get("code") or "Vot de plen"
    title = (law.get("title") or vote.get("description") or "").strip()
    chamber = "Camera Deputaților" if vote.get("chamber") == "deputies" else "Senat"
    outcome = vote.get("outcome")
    verdict = {"adoptat": "ADOPTAT ✅", "respins": "RESPINS ❌"}.get(outcome, "")
    fc, ac, bc = vote.get("for_count") or 0, vote.get("against_count") or 0, vote.get("abstention_count") or 0
    link = f"{cfg.site_url}/voturi/{vote['id']}"

    summary = (law.get("summary") or "").strip()

    lines = [
        f"{code} · {chamber}",
        "",
        title,
    ]
    # Plain-language explainer — the hook that makes a post readable for everyone.
    if summary:
        lines += ["", summary]
    if verdict:
        lines += ["", verdict]
    lines += [
        f"🟢 {fc} pentru   🔴 {ac} împotrivă   🟣 {bc} abțineri",
        "",
        f"Detalii și voturi individuale: {link}",
        "",
        "#parlament #politicaRomânească #laButoane #transparență #românia",
    ]
    return "\n".join(lines)


# ── Instagram API ─────────────────────────────────────────────────────────────
def exchange_token(cfg: Config, short_lived: str) -> dict:
    """Exchange a short-lived token for a 60-day one. Unversioned endpoint."""
    if not cfg.app_secret:
        sys.exit("ERROR: IG_APP_SECRET must be set for --exchange-token")
    r = requests.get(
        f"{GRAPH}/access_token",
        params={
            "grant_type": "ig_exchange_token",
            "client_secret": cfg.app_secret,
            "access_token": short_lived,
        },
        timeout=_TIMEOUT,
    )
    if not r.ok:
        sys.exit(f"token exchange failed ({r.status_code}): {r.text}")
    return r.json()


def refresh_token(cfg: Config) -> dict:
    """Extend the current long-lived token by another 60 days (must be >24h old)."""
    if not cfg.token:
        sys.exit("ERROR: IG_ACCESS_TOKEN must be set for --refresh-token")
    r = requests.get(
        f"{GRAPH}/refresh_access_token",
        params={"grant_type": "ig_refresh_token", "access_token": cfg.token},
        timeout=_TIMEOUT,
    )
    if not r.ok:
        sys.exit(f"token refresh failed ({r.status_code}): {r.text}")
    return r.json()


def verify_token(cfg: Config) -> dict:
    """Return basic info about the IG account the token can publish to."""
    cfg.require_publishing()
    r = requests.get(
        f"{GRAPH}/{cfg.version}/{cfg.ig_user_id}",
        params={"fields": "id,username,name", "access_token": cfg.token},
        timeout=_TIMEOUT,
    )
    if not r.ok:
        sys.exit(f"Token check failed ({r.status_code}): {r.text}")
    return r.json()


def _create_container(cfg: Config, image_url: str, caption: str) -> str:
    r = requests.post(
        f"{GRAPH}/{cfg.version}/{cfg.ig_user_id}/media",
        params={"image_url": image_url, "caption": caption, "access_token": cfg.token},
        timeout=_TIMEOUT,
    )
    if not r.ok:
        raise RuntimeError(f"create container failed ({r.status_code}): {r.text}")
    return r.json()["id"]


def _wait_ready(cfg: Config, creation_id: str, tries: int = 10, delay: float = 2.0) -> None:
    for _ in range(tries):
        r = requests.get(
            f"{GRAPH}/{cfg.version}/{creation_id}",
            params={"fields": "status_code,status", "access_token": cfg.token},
            timeout=_TIMEOUT,
        )
        status = r.json().get("status_code")
        if status == "FINISHED":
            return
        if status == "ERROR":
            raise RuntimeError(f"container processing error: {r.json()}")
        time.sleep(delay)
    raise RuntimeError("container not ready in time")


def _publish(cfg: Config, creation_id: str) -> str:
    r = requests.post(
        f"{GRAPH}/{cfg.version}/{cfg.ig_user_id}/media_publish",
        params={"creation_id": creation_id, "access_token": cfg.token},
        timeout=_TIMEOUT,
    )
    if not r.ok:
        raise RuntimeError(f"publish failed ({r.status_code}): {r.text}")
    return r.json()["id"]


def post_image(cfg: Config, image_url: str, caption: str) -> str:
    """Create a container, wait for it to be ready, and publish. Returns media id."""
    cfg.require_publishing()
    creation_id = _create_container(cfg, image_url, caption)
    _wait_ready(cfg, creation_id)
    return _publish(cfg, creation_id)


def _create_child(cfg: Config, image_url: str) -> str:
    r = requests.post(
        f"{GRAPH}/{cfg.version}/{cfg.ig_user_id}/media",
        params={"image_url": image_url, "is_carousel_item": "true", "access_token": cfg.token},
        timeout=_TIMEOUT,
    )
    if not r.ok:
        raise RuntimeError(f"create child container failed ({r.status_code}): {r.text}")
    return r.json()["id"]


def post_carousel(cfg: Config, image_urls: list[str], caption: str) -> str:
    """Publish a carousel (2–10 slides). Returns media id."""
    cfg.require_publishing()
    if not 2 <= len(image_urls) <= 10:
        sys.exit(f"carousel needs 2–10 images, got {len(image_urls)}")
    children = []
    for url in image_urls:
        cid = _create_child(cfg, url)
        _wait_ready(cfg, cid)
        children.append(cid)
    r = requests.post(
        f"{GRAPH}/{cfg.version}/{cfg.ig_user_id}/media",
        params={
            "media_type": "CAROUSEL",
            "children": ",".join(children),
            "caption": caption,
            "access_token": cfg.token,
        },
        timeout=_TIMEOUT,
    )
    if not r.ok:
        raise RuntimeError(f"create carousel failed ({r.status_code}): {r.text}")
    creation_id = r.json()["id"]
    _wait_ready(cfg, creation_id)
    return _publish(cfg, creation_id)


# Bump after card design changes — og images are CDN-cached immutable per URL.
# KEEP IN SYNC with frontend/lib/ig-carousel.ts (admin page derives the same
# slide manifest + static hashes from it).
CARD_V = "11"


def _initiator_line(cfg: Config, law_id: str) -> str | None:
    """Compact 'Inițiativă: …' line — mirrors the summarycard route logic."""
    rows = _sb_get(cfg, "laws", {"id": f"eq.{law_id}", "select": "initiator_type", "limit": "1"})
    itype = rows[0].get("initiator_type") if rows else None
    if itype == "guvern":
        return "Inițiativă: Guvernul României"
    if itype == "cetateni":
        return "Inițiativă cetățenească"
    if itype != "parlamentari":
        return None
    people = _sb_get(cfg, "law_initiators", {"law_id": f"eq.{law_id}", "select": "role_raw,party_raw"})
    n = len(people)
    if not n:
        return None
    roles = {p.get("role_raw") for p in people if p.get("role_raw")}
    noun = ("senator" if n == 1 else "senatori") if roles == {"senator"} else \
           ("deputat" if n == 1 else "deputați") if roles == {"deputat"} else \
           ("parlamentar" if n == 1 else "parlamentari")
    de = "de " if n >= 20 else ""
    # stored party strings can be raw fisa text — minority orgs fold into MIN
    import re as _re
    import unicodedata as _ud

    def norm(p: str) -> str:
        folded = "".join(c for c in _ud.normalize("NFKD", p) if not _ud.combining(c)).lower()
        if "minorit" in folded:
            return "MIN"
        return _re.split(r"\s+A devenit|\(", p)[0].strip()

    counts: dict[str, int] = {}
    for p in people:
        if p.get("party_raw"):
            key = norm(p["party_raw"])
            if key:
                counts[key] = counts.get(key, 0) + 1
    majority = next((k for k, c in counts.items() if c / n >= 0.8), None)
    if majority:
        return f"Inițiativă: {n} {de}{noun} {majority}"
    if len(counts) > 3:
        de_p = " de" if len(counts) >= 20 else ""
        return f"Inițiativă: {n} {de}{noun} din {len(counts)}{de_p} partide"
    parties = ", ".join(counts)
    return f"Inițiativă: {n} {de}{noun}" + (f" ({parties})" if parties else "")


def _law_slides(cfg: Config, law_id: str, hook: str | None = None) -> tuple[list[str], str]:
    """Single source of truth for a law carousel: the ordered og-card *suffixes*
    (summary → tacit → chambers chronologically → deviation) and the caption.
    Both dynamic and --static posting, plus --emit-slides for the offline
    renderer, derive everything from here so they can never drift."""
    cfg.require_supabase()
    rows = _sb_get(cfg, "law_status", {"law_id": f"eq.{law_id}", "select": "*", "limit": "1"})
    if not rows:
        sys.exit(f"law {law_id} not found in law_status")
    law = rows[0]

    # &v= cache-buster: dynamic og responses are CDN-cached immutable, so a slide
    # URL fetched before a card redesign would serve the stale image forever. It
    # also versions the static filename (new v → new suffix → new hash → new
    # file), so pre-rendered slides can't go stale either. Bump after redesigns.
    #
    # A catchy headline (laws.headline) → a hook COVER slide first, and the
    # summary card drops the headline (nohl) so it isn't repeated. Must match
    # frontend/lib/ig-carousel.ts lawSlides() suffix-for-suffix (shared hashes).
    has_headline = bool(_sb_get(cfg, "laws", {
        "id": f"eq.{law_id}", "select": "headline", "limit": "1"})[0].get("headline"))
    suffixes = []
    if has_headline:
        suffixes.append(f"og/hookcard?id={law_id}&v={CARD_V}")
    suffixes.append(f"og/summarycard?id={law_id}"
                    + ("&nohl=1" if has_headline else "") + f"&v={CARD_V}")
    passed = bool(law.get("presidential_status"))
    # Tacit slide right after the summary: a chamber the law passed without a
    # plenary vote gets the "nimeni nu a votat" card.
    for key, vote_field in (("senate", "senate_vote_id"), ("camera", "camera_vote_id")):
        if passed and not law.get(vote_field):
            suffixes.append(f"og/tacitcard?id={law_id}&chamber={key}&v={CARD_V}")
    chambers = []  # (date, chamber_key, vote_id)
    if law.get("senate_vote_id"):
        chambers.append((law.get("senate_vote_date") or "", "senate", law["senate_vote_id"]))
    if law.get("camera_vote_id"):
        chambers.append((law.get("camera_vote_date") or "", "camera", law["camera_vote_id"]))
    chambers.sort()
    for _, key, _vid in chambers:
        suffixes.append(f"og/lawcard?id={law_id}&chamber={key}&v={CARD_V}")

    # Deviation slide — only when someone actually broke the party line.
    dev_vote, dev_count = None, 0
    for _, _key, vid in chambers:
        n = len(_sb_get(cfg, "politician_votes", {
            "vote_id": f"eq.{vid}", "party_line_deviation": "eq.true", "select": "id",
        }))
        if n > dev_count:
            dev_vote, dev_count = vid, n
    if dev_vote:
        suffixes.append(f"og/deviationcard?vote={dev_vote}&v={CARD_V}")

    # Caption
    tacit = passed and len(chambers) < 2
    outcome = {
        "promulgat": "PROMULGATĂ ✅", "retrimis": "RETRIMISĂ ÎN PARLAMENT ↩️",
        "sesizat_ccr": "TRIMISĂ LA CCR ⚖️",
    }.get(law.get("presidential_status") or "", "")
    lines = [f"{law['code']} · {(law.get('title') or '').strip()}"]
    if hook:
        lines = [hook.strip(), ""] + lines
    if law.get("summary"):
        lines += ["", law["summary"].strip()]
    ini = _initiator_line(cfg, law_id)
    if ini:
        lines += ["", ini]
    if outcome:
        lines += ["", outcome]
    if tacit:
        missing = "Senat" if not law.get("senate_vote_id") else "Camera Deputaților"
        lines += ["", f"⚠️ Adoptată tacit de {missing}: termenul constituțional a expirat fără vot (art. 75)."]
    if dev_count:
        lines += ["", (
            "⚡ 1 parlamentar a votat împotriva propriului partid (ultimul slide)." if dev_count == 1
            else f"⚡ {dev_count} parlamentari au votat împotriva propriului partid (ultimul slide)."
        )]
    lines += ["", "Voturile individuale, pe site: link în bio.", "",
              "#parlament #transparență #românia #politică #laButoane"]
    return suffixes, "\n".join(lines)


def post_law(cfg: Config, law_id: str, dry_run: bool = False, hook: str | None = None,
             static: bool = False) -> str | None:
    """Standard law carousel: summary hook → chambers in chronological order
    (a missing chamber vote on a passed law = tacit adoption, said in the
    caption) → deviation slide when someone broke the party line.

    static=True fetches pre-rendered slides from {SITE_URL}/ig/ instead of the
    /api/og routes — needed on the Cloudflare Free plan, where the hemicycle
    cards 503. Render them first with frontend/scripts/render-ig.mjs."""
    suffixes, caption = _law_slides(cfg, law_id, hook)
    slides = [_slide_url(cfg, s, static) for s in suffixes]

    if dry_run:
        print("── DRY RUN ──")
        for s in slides:
            print("slide:", s)
        print("caption:\n" + caption)
        return None
    media_id = post_carousel(cfg, slides, caption) if len(slides) > 1 else post_image(cfg, slides[0], caption)
    print(f"Published. media_id={media_id}")
    return media_id


def _month_label(dfrom: str, dto: str) -> str:
    """'iunie 2026' when [dfrom,dto] is exactly one calendar month, else 'from – to'."""
    try:
        a, b = _dt.date.fromisoformat(dfrom), _dt.date.fromisoformat(dto)
    except ValueError:
        return f"{dfrom} – {dto}"
    last = (a.replace(day=28) + _dt.timedelta(days=4)).replace(day=1) - _dt.timedelta(days=1)
    if a.day == 1 and (a.year, a.month) == (b.year, b.month) and b == last:
        return f"{RO_MONTHS[a.month - 1]} {a.year}"
    return f"{dfrom} – {dto}"


def _sb_rows(cfg: Config, table: str, params: list[tuple[str, str]]) -> list[dict]:
    """GET with list-of-tuples params so a column can be filtered twice (vote_date
    gte AND lte)."""
    r = requests.get(
        f"{cfg.supabase_url}/rest/v1/{table}", params=params,
        headers={"apikey": cfg.supabase_key, "Authorization": f"Bearer {cfg.supabase_key}"},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


# Below this many plenary votes in the window a per-chamber ranking is noise
# (a recess month of 3 votes makes "100% absent" meaningless) — skip the chamber.
_MIN_HELD = 5


def _interval_absences(cfg: Config, dfrom: str, dto: str, top: int = 5) -> tuple[list[dict], list[str]]:
    """Top absentees within [dfrom,dto]. Absence = (votes the chamber held in the
    window − the member's participations) / votes held. Active, non-Government
    members who were seated for the whole window (mandate_start ≤ dfrom); members
    who joined mid-window are dropped (incomplete denominator would fake absence).
    Members carrying a context_note (medical leave, official delegation, …) are
    excluded — the static card can't show the ⓘ caveat the site does, and posting
    "100% absent" against someone on documented leave is the defamation liability
    the whole context_note flow exists to prevent.

    Returns (ranking, warnings) — warnings are sanity flags for a human to eyeball
    before publishing (a 100% top entry or a monthly rate that wildly diverges from
    the member's all-time rate is usually a scraper gap, not a real absentee)."""
    cfg.require_supabase()
    mstart = {row["id"]: (row.get("mandate_start") or "2000-01-01")
              for row in _sb_get(cfg, "politicians", {"active": "is.true", "select": "id,mandate_start", "limit": "1000"})}
    ranked: list[dict] = []
    warnings: list[str] = []
    for view, chamber_key, label in (("senator_stats", "senate", "SENAT"), ("deputy_stats", "deputies", "CAMERĂ")):
        held = len(_sb_rows(cfg, "votes", [
            ("select", "id"), ("vote_date", f"gte.{dfrom}"), ("vote_date", f"lte.{dto}"),
            ("chamber", f"eq.{chamber_key}"), ("limit", "5000")]))
        if held == 0:
            continue
        if held < _MIN_HELD:
            warnings.append(f"{label}: doar {held} voturi în plen în perioadă — camera exclusă (prea puține pentru un clasament)")
            continue
        present: dict[str, int] = {}
        PAGE = 1000
        for off in range(0, 200000, PAGE):
            batch = _sb_rows(cfg, "politician_votes", [
                ("select", "politician_id,votes!inner(vote_date,chamber)"),
                ("votes.vote_date", f"gte.{dfrom}"), ("votes.vote_date", f"lte.{dto}"),
                ("votes.chamber", f"eq.{chamber_key}"), ("limit", str(PAGE)), ("offset", str(off))])
            for row in batch:
                present[row["politician_id"]] = present.get(row["politician_id"], 0) + 1
            if len(batch) < PAGE:
                break
        excluded = 0
        for m in _sb_get(cfg, view, {
            "select": "politician_id,name,first_name,party_abbr,party_color,presence_pct,context_note",
            "active": "eq.true", "gov_role": "is.null", "limit": "1000",
        }):
            pid = m["politician_id"]
            if mstart.get(pid, "2000-01-01") > dfrom:
                continue
            if m.get("context_note"):
                excluded += 1
                continue
            absent = max(0, held - present.get(pid, 0))
            ranked.append({
                "pct": round(absent / held * 100),
                "absent": absent,
                "held": held,
                # all-time absence, for the divergence sanity check
                "alltime_pct": round(100 - (m["presence_pct"] or 100)),
                "name": f"{m['first_name']} {m['name']}",
                "party": m["party_abbr"] or "IND",
                "color": m["party_color"] or "#9e9e9e",
                "chamber": label,
            })
        if excluded:
            warnings.append(f"{label}: {excluded} membri excluși (au notă de context — concediu/delegație)")
    # exact fraction, not the rounded pct — ties like 126/142 vs 127/142 must order right
    ranked.sort(key=lambda e: e["absent"] / e["held"], reverse=True)
    ranked = ranked[:top]
    # sanity gates on the most sensitive number we publish
    if ranked and ranked[0]["pct"] == 100:
        warnings.append(f"#1 e la 100% ({ranked[0]['name']}) — verifică: e mai des o lipsă de scraper decât o absență reală")
    for e in ranked:
        if abs(e["pct"] - e["alltime_pct"]) >= 40:
            warnings.append(f"{e['name']}: {e['pct']}% în perioadă vs {e['alltime_pct']}% istoric — divergență mare, verifică")
    return ranked, warnings


def _sign_card(d: str) -> str:
    """HMAC signature the shamecard route verifies before rendering passed data —
    keeps the public route from minting arbitrary branded absence cards."""
    secret = os.environ.get("CARD_SIGN_SECRET", "")
    if not secret:
        sys.exit("ERROR: CARD_SIGN_SECRET must be set (same value in the frontend env) "
                 "to post interval absence cards.")
    return _hmac.new(secret.encode(), d.encode(), hashlib.sha256).hexdigest()[:32]


def _shame_interval(cfg: Config, dfrom: str, dto: str) -> tuple[str, str, list[str]]:
    """Build the interval shame post: (signed image URL, caption, sanity warnings).
    Shared by --shame (publish/dry-run) and --email-preview (approval mail)."""
    top, warnings = _interval_absences(cfg, dfrom, dto)
    if not top:
        sys.exit(f"no rankable plenary votes in {dfrom}..{dto}"
                 + ("\n" + "\n".join("  ⚠ " + w for w in warnings) if warnings else ""))
    label = _month_label(dfrom, dto)
    d = json.dumps(
        [{"n": e["name"], "p": e["party"], "c": e["color"], "ch": e["chamber"],
          "a": e["pct"], "x": e["absent"], "h": e["held"]} for e in top],
        ensure_ascii=False, separators=(",", ":"))
    # base64url, not percent-encoded JSON: URL normalization between Cloudflare
    # and the route decodes %23 → '#', turning the tail of the query into a
    # fragment and silently dropping &sig. b64url survives every decode layer.
    payload = _b64.urlsafe_b64encode(d.encode()).decode().rstrip("=")
    image_url = f"{cfg.site_url}/api/og/shamecard?d={payload}&label={_quote(label)}&sig={_sign_card(payload)}"
    lines = [f"🔴 Absențe — {label}: cei mai absenți parlamentari", "",
             f"Absențe la voturile din plen în {label}:", ""]
    lines += [f"{i+1}. {e['name']} ({e['party']}, {e['chamber']}) — {e['pct']}% absențe ({e['absent']}/{e['held']} voturi)"
              for i, e in enumerate(top)]
    lines += ["", "Doar parlamentarii activi toată perioada, fără cei cu notă de context (concediu/delegație). "
              "Membrii Guvernului nu sunt incluși.",
              "", f"Toată lista: {cfg.site_url}", "",
              "#parlament #absenteism #laButoane #transparență #românia"]
    return image_url, "\n".join(lines), warnings


def _admin_link_html(cfg: Config, image_url: str, caption: str) -> str:
    """One-tap 'publish from the browser' button for the approval email — hits
    the login exchange (/api/admin/login?key=…&next=…), which sets the httpOnly
    admin cookie and redirects to /admin with the image + caption prefilled
    (b64url, same lesson as the card payload: raw URLs/text in query params get
    mangled). The key is consumed once by the exchange, not left in a bookmarked
    URL. Needs ADMIN_KEY in the env; without it the email keeps only the CLI
    command."""
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key:
        return ""
    b64 = lambda s: _b64.urlsafe_b64encode(s.encode()).decode().rstrip("=")
    nxt = _quote(f"/admin?img={b64(image_url)}&cap={b64(caption)}", safe="")
    href = f"{cfg.site_url}/api/admin/login?key={_quote(admin_key)}&next={nxt}"
    return (f'<p style="margin:0 0 12px;"><a href="{_html.escape(href, quote=True)}" '
            f'style="display:inline-block;background:#171A1F;color:#FFFFFF;text-decoration:none;'
            f'border-radius:8px;padding:10px 18px;font-weight:600;">Deschide în admin → publică</a></p>'
            f'<p style="margin:0 0 12px;color:#6E7480;font-size:13px;">sau din terminal:</p>')


def email_shame_preview(cfg: Config, to_addr: str, dfrom: str, dto: str) -> None:
    """Approval email for the monthly absence card: image + caption + sanity
    warnings, plus the exact command to publish. NEVER publishes anything —
    a human reads the mail, eyeballs the warnings, and runs the command."""
    cfg.require_supabase()
    image_url, caption, warnings = _shame_interval(cfg, dfrom, dto)
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        sys.exit("RESEND_API_KEY must be set to send the preview email")
    sender = os.environ.get("NEWSLETTER_FROM", "LaButoane <newsletter@resend.dev>")
    label = _month_label(dfrom, dto)
    # exact calendar month → the short --luna form; anything else → explicit window
    publish_cmd = (f"python scraper/instagram_poster.py --shame --luna {dfrom[:7]}"
                   if "–" not in label else
                   f"python scraper/instagram_poster.py --shame --from {dfrom} --to {dto}")
    warn_html = "".join(
        f'<li style="margin:4px 0;">⚠ {_html.escape(w)}</li>' for w in warnings)
    warn_block = (
        f'<div style="background:#FEF3E2;border:1px solid #E3A23C;border-radius:8px;'
        f'padding:12px 16px;margin:0 0 20px;">'
        f'<strong>Verifică înainte de publicare:</strong><ul style="margin:8px 0 0;padding-left:18px;">{warn_html}</ul></div>'
        if warnings else
        '<div style="color:#2EA871;margin:0 0 20px;">✓ Nicio alertă de sanitate — dar tot aruncă un ochi.</div>')
    body = f"""<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:600px;margin:0 auto;color:#171A1F;">
  <h2 style="margin:24px 0 4px;">Absențe — {_html.escape(label)}: card IG de aprobat</h2>
  <p style="color:#6E7480;margin:0 0 20px;">Generat automat pe 1 ale lunii. Nu se publică nimic fără tine.</p>
  {warn_block}
  <a href="{_html.escape(image_url, quote=True)}"><img src="{_html.escape(image_url, quote=True)}" alt="Card absențe {_html.escape(label)}" width="540" style="width:100%;max-width:540px;border:1px solid #E7E9EC;border-radius:8px;" /></a>
  <h3 style="margin:24px 0 8px;">Caption</h3>
  <pre style="background:#F6F7F8;border:1px solid #E7E9EC;border-radius:8px;padding:14px;white-space:pre-wrap;font-size:13px;line-height:1.5;">{_html.escape(caption)}</pre>
  <h3 style="margin:24px 0 8px;">Publicare (după verificare)</h3>
  {_admin_link_html(cfg, image_url, caption)}
  <pre style="background:#171A1F;color:#F6F7F8;border-radius:8px;padding:14px;font-size:13px;">cd /opt/votro &amp;&amp; {_html.escape(publish_cmd)}</pre>
</div>"""
    r = requests.post("https://api.resend.com/emails",
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      json={"from": sender, "to": [to_addr],
                            "subject": f"[LaButoane] Aprobare card absențe — {label}"
                                       + (f" ({len(warnings)} alerte)" if warnings else ""),
                            "html": body},
                      timeout=30)
    if not r.ok:
        sys.exit(f"preview email failed ({r.status_code}): {r.text[:300]}")
    print(f"Preview email sent to {to_addr}. id={r.json().get('id')}")


def post_shame(cfg: Config, dry_run: bool = False,
               dfrom: str | None = None, dto: str | None = None) -> str | None:
    """Shame-corner post: top absentees. All-time by default; with a [dfrom,dto]
    window it's "absențe pe perioadă" (e.g. a month), computed live and rendered
    from a signed payload so the card stays light and can't be spoofed."""
    cfg.require_supabase()
    if dfrom and dto:
        image_url, caption, warnings = _shame_interval(cfg, dfrom, dto)
        for w in warnings:
            print(f"⚠ {w}", file=sys.stderr)
    else:
        entries = []
        for view, chamber in (("senator_stats", "Senat"), ("deputy_stats", "Cameră")):
            for s in _sb_get(cfg, view, {
                "select": "name,first_name,party_abbr,presence_pct",
                "active": "eq.true", "gov_role": "is.null",
                "order": "presence_pct.asc", "limit": "5",
            }):
                entries.append((round(100 - (s["presence_pct"] or 100)),
                                f"{s['first_name']} {s['name']}", s["party_abbr"], chamber))
        entries.sort(reverse=True)
        top = entries[:5]
        lines = ["🔴 Absențe — top 5: cei mai absenți parlamentari", "",
                 "Absențe la voturile din plen, de la începutul legislaturii (20 decembrie 2024):", ""]
        lines += [f"{i+1}. {name} ({party}, {chamber}) — {pct}% absențe"
                  for i, (pct, name, party, chamber) in enumerate(top)]
        lines += ["", "Membrii Guvernului nu sunt incluși — ei nu votează în plen.",
                  "", f"Toată lista: {cfg.site_url}", "",
                  "#parlament #absenteism #laButoane #transparență #românia"]
        caption = "\n".join(lines)
        image_url = f"{cfg.site_url}/api/og/shamecard"

    if dry_run:
        print("── DRY RUN ──")
        print("image:", image_url)
        print("caption:\n" + caption)
        return None
    media_id = post_image(cfg, image_url, caption)
    print(f"Published. media_id={media_id}")
    return media_id


def post_vote(cfg: Config, vote_id: str, dry_run: bool = False) -> str | None:
    cfg.require_supabase()
    vote = fetch_vote(cfg, vote_id)
    if not vote:
        sys.exit(f"vote {vote_id} not found")
    image_url = f"{cfg.site_url}/api/og/votecard?vote={vote_id}"
    caption = build_vote_caption(cfg, vote)
    if dry_run:
        print("── DRY RUN ──")
        print("image:", image_url)
        print("caption:\n" + caption)
        return None
    media_id = post_image(cfg, image_url, caption)
    print(f"Published. media_id={media_id}")
    return media_id


# ── CLI ───────────────────────────────────────────────────────────────────────
def main() -> None:
    load_dotenv()
    cfg = Config()

    ap = argparse.ArgumentParser(description="Publish a VotRO post to Instagram.")
    ap.add_argument("--exchange-token", metavar="SHORT_TOKEN",
                    help="exchange a short-lived token for a 60-day one")
    ap.add_argument("--refresh-token", action="store_true",
                    help="extend the current IG_ACCESS_TOKEN by 60 days")
    ap.add_argument("--verify", action="store_true", help="check the access token / account")
    ap.add_argument("--vote", help="vote id to build and publish a post for")
    ap.add_argument("--law", help="law id — publish the standard law carousel (summary → chambers → deviations)")
    ap.add_argument("--hook", help="editorial first line for the --law caption")
    ap.add_argument("--static", action="store_true",
                    help="fetch pre-rendered slides from {SITE_URL}/ig/ instead of /api/og "
                         "(Cloudflare Free plan: render first with frontend/scripts/render-ig.mjs)")
    ap.add_argument("--emit-slides", metavar="LAW_ID",
                    help="print the law carousel's slide manifest as JSON (used by the offline "
                         "renderer); does not contact Instagram")
    ap.add_argument("--shame", action="store_true", help="publish the shame-corner card (top absentees)")
    ap.add_argument("--from", dest="dfrom", metavar="YYYY-MM-DD", help="--shame: window start (needs --to)")
    ap.add_argument("--to", dest="dto", metavar="YYYY-MM-DD", help="--shame: window end")
    ap.add_argument("--luna", metavar="YYYY-MM", help="--shame shortcut: absences for one calendar month")
    ap.add_argument("--email-preview", nargs="?", const="", metavar="ADDR",
                    help="--shame: DON'T publish — email the interval card + caption + sanity "
                         "warnings to ADDR (or $IG_PREVIEW_EMAIL) for manual approval. "
                         "Without a window, defaults to last calendar month (cron on the 1st).")
    ap.add_argument("--carousel", nargs="+", metavar="URL", help="publish a carousel from 2–10 image URLs (with --caption)")
    ap.add_argument("--image-url", help="post an arbitrary image URL (with --caption)")
    ap.add_argument("--caption", help="caption for --image-url / --carousel")
    ap.add_argument("--dry-run", action="store_true", help="print instead of publishing")
    args = ap.parse_args()

    if args.exchange_token:
        info = exchange_token(cfg, args.exchange_token)
        print(f"IG_ACCESS_TOKEN={info['access_token']}")
        print(f"# expires in {info['expires_in'] // 86400} days — put it in scraper/.env")
        return
    if args.refresh_token:
        info = refresh_token(cfg)
        print(f"IG_ACCESS_TOKEN={info['access_token']}")
        print(f"# expires in {info['expires_in'] // 86400} days — put it in scraper/.env")
        return
    if args.verify:
        print(verify_token(cfg))
        return
    if args.emit_slides:
        # Manifest for the offline renderer — no Instagram credentials required.
        suffixes, caption = _law_slides(cfg, args.emit_slides, args.hook)
        print(json.dumps({
            "law_id": args.emit_slides,
            "slides": [{"suffix": s, "name": _slide_name(s)} for s in suffixes],
            "caption": caption,
        }))
        return
    if args.vote:
        post_vote(cfg, args.vote, dry_run=args.dry_run)
        return
    if args.law:
        post_law(cfg, args.law, dry_run=args.dry_run, hook=args.hook, static=args.static)
        return
    if args.shame:
        dfrom, dto = args.dfrom, args.dto
        if args.luna:
            y, m = map(int, args.luna.split("-"))
            first = _dt.date(y, m, 1)
            last = (first.replace(day=28) + _dt.timedelta(days=4)).replace(day=1) - _dt.timedelta(days=1)
            dfrom, dto = first.isoformat(), last.isoformat()
        if args.email_preview is not None:
            to_addr = args.email_preview or os.environ.get("IG_PREVIEW_EMAIL", "")
            if not to_addr:
                sys.exit("--email-preview needs an address (argument or IG_PREVIEW_EMAIL in .env)")
            if not (dfrom and dto):
                # cron on the 1st: previous calendar month
                last_prev = _dt.date.today().replace(day=1) - _dt.timedelta(days=1)
                dfrom, dto = last_prev.replace(day=1).isoformat(), last_prev.isoformat()
            email_shame_preview(cfg, to_addr, dfrom, dto)
            return
        post_shame(cfg, dry_run=args.dry_run, dfrom=dfrom, dto=dto)
        return
    if args.carousel:
        if args.dry_run:
            for u in args.carousel:
                print("slide:", u)
            print("caption:\n" + (args.caption or ""))
            return
        print("Published. media_id=" + post_carousel(cfg, args.carousel, args.caption or ""))
        return
    if args.image_url:
        if args.dry_run:
            print("image:", args.image_url, "\ncaption:\n", args.caption or "")
            return
        print("Published. media_id=" + post_image(cfg, args.image_url, args.caption or ""))
        return
    ap.print_help()


if __name__ == "__main__":
    main()
