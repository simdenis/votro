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
    python instagram_poster.py --carousel <url> <url> … --caption "..."  # any carousel
    python instagram_poster.py --vote <vote_id> --dry-run   # print, do not publish
    python instagram_poster.py --image-url <url> --caption "..."   # post anything
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import requests
from dotenv import load_dotenv

GRAPH = "https://graph.instagram.com"
_TIMEOUT = 30


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
    link = f"{cfg.site_url}/votes/{vote['id']}"

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


def post_law(cfg: Config, law_id: str, dry_run: bool = False) -> str | None:
    """Standard law carousel: summary hook → chambers in chronological order
    (a missing chamber vote on a passed law = tacit adoption, said in the
    caption) → deviation slide when someone broke the party line."""
    cfg.require_supabase()
    rows = _sb_get(cfg, "law_status", {"law_id": f"eq.{law_id}", "select": "*", "limit": "1"})
    if not rows:
        sys.exit(f"law {law_id} not found in law_status")
    law = rows[0]

    slides = [f"{cfg.site_url}/api/og/summarycard?id={law_id}"]
    passed = bool(law.get("presidential_status"))
    # Tacit slide right after the summary: a chamber the law passed without a
    # plenary vote gets the "nimeni nu a votat" card.
    for key, vote_field in (("senate", "senate_vote_id"), ("camera", "camera_vote_id")):
        if passed and not law.get(vote_field):
            slides.append(f"{cfg.site_url}/api/og/tacitcard?id={law_id}&chamber={key}")
    chambers = []  # (date, chamber_key, vote_id)
    if law.get("senate_vote_id"):
        chambers.append((law.get("senate_vote_date") or "", "senate", law["senate_vote_id"]))
    if law.get("camera_vote_id"):
        chambers.append((law.get("camera_vote_date") or "", "camera", law["camera_vote_id"]))
    chambers.sort()
    for _, key, _vid in chambers:
        slides.append(f"{cfg.site_url}/api/og/lawcard?id={law_id}&chamber={key}")

    # Deviation slide — only when someone actually broke the party line.
    dev_vote, dev_count = None, 0
    for _, _key, vid in chambers:
        n = len(_sb_get(cfg, "politician_votes", {
            "vote_id": f"eq.{vid}", "party_line_deviation": "eq.true", "select": "id",
        }))
        if n > dev_count:
            dev_vote, dev_count = vid, n
    if dev_vote:
        slides.append(f"{cfg.site_url}/api/og/deviationcard?vote={dev_vote}")

    # Caption
    passed = bool(law.get("presidential_status"))
    tacit = passed and len(chambers) < 2
    outcome = {
        "promulgat": "PROMULGATĂ ✅", "retrimis": "RETRIMISĂ ÎN PARLAMENT ↩️",
        "sesizat_ccr": "TRIMISĂ LA CCR ⚖️",
    }.get(law.get("presidential_status") or "", "")
    lines = [f"{law['code']} · {(law.get('title') or '').strip()}"]
    if law.get("summary"):
        lines += ["", law["summary"].strip()]
    if outcome:
        lines += ["", outcome]
    if tacit:
        missing = "Senat" if not law.get("senate_vote_id") else "Camera Deputaților"
        lines += ["", f"⚠️ Adoptată tacit de {missing}: termenul constituțional a expirat fără vot (art. 75)."]
    if dev_count:
        lines += ["", f"⚡ {dev_count} parlamentari au votat împotriva propriului partid (ultimul slide)."]
    lines += ["", f"Voturi individuale: {cfg.site_url}/legi/{law_id}", "",
              "#parlament #politicaRomânească #laButoane #transparență #românia"]
    caption = "\n".join(lines)

    if dry_run:
        print("── DRY RUN ──")
        for s in slides:
            print("slide:", s)
        print("caption:\n" + caption)
        return None
    media_id = post_carousel(cfg, slides, caption) if len(slides) > 1 else post_image(cfg, slides[0], caption)
    print(f"Published. media_id={media_id}")
    return media_id


def post_shame(cfg: Config, dry_run: bool = False) -> str | None:
    """Shame-corner post: top absentees across both chambers."""
    cfg.require_supabase()
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

    lines = ["🔴 Colțul rușinii — cei mai absenți parlamentari", "",
             "Absențe la voturile din plen, de la validarea mandatului:", ""]
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
    ap.add_argument("--shame", action="store_true", help="publish the shame-corner card (top absentees)")
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
    if args.vote:
        post_vote(cfg, args.vote, dry_run=args.dry_run)
        return
    if args.law:
        post_law(cfg, args.law, dry_run=args.dry_run)
        return
    if args.shame:
        post_shame(cfg, dry_run=args.dry_run)
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
