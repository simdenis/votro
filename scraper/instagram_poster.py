"""Publish VotRO posts to Instagram via the Instagram Graph API.

This is the publishing pipeline only — it never runs automatically. You invoke
it explicitly (CLI below) once you have set the credentials. The post image is
served by the Next.js route `/api/og/post?vote=<id>` (public URL on Vercel),
which the Graph API fetches when creating the media container.

Required environment (in scraper/.env or the shell):
    SUPABASE_URL, SUPABASE_KEY      already used by the scrapers
    SITE_URL                        e.g. https://votro.ro (no trailing slash)
    IG_USER_ID                      Instagram *Business/Creator* account id
    IG_ACCESS_TOKEN                 long-lived token with instagram_basic +
                                    instagram_content_publish + pages_read_engagement
    GRAPH_API_VERSION               optional, defaults to v21.0

Flow (Instagram Content Publishing API):
    1. POST /{ig-user-id}/media          -> creation_id  (container)
    2. GET  /{creation_id}?fields=status_code  -> poll until FINISHED
    3. POST /{ig-user-id}/media_publish  -> media_id     (goes live)

Usage:
    python instagram_poster.py --verify                 # check the token
    python instagram_poster.py --vote <vote_id>         # build + publish a vote post
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

GRAPH = "https://graph.facebook.com"
_TIMEOUT = 30


# ── Config ──────────────────────────────────────────────────────────────────
class Config:
    def __init__(self) -> None:
        self.supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.supabase_key = os.environ.get("SUPABASE_KEY", "")
        self.site_url     = os.environ.get("SITE_URL", "https://votro.ro").rstrip("/")
        self.ig_user_id   = os.environ.get("IG_USER_ID", "")
        self.token        = os.environ.get("IG_ACCESS_TOKEN", "")
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
def fetch_vote(cfg: Config, vote_id: str) -> dict | None:
    r = requests.get(
        f"{cfg.supabase_url}/rest/v1/votes",
        params={"id": f"eq.{vote_id}", "select": "*,laws(*)", "limit": "1"},
        headers={"apikey": cfg.supabase_key, "Authorization": f"Bearer {cfg.supabase_key}"},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


# ── Caption builder ───────────────────────────────────────────────────────────
def build_vote_caption(cfg: Config, vote: dict) -> str:
    law = vote.get("laws") or {}
    code = law.get("code") or "—"
    title = (law.get("title") or "").strip()
    chamber = "Camera Deputaților" if vote.get("chamber") == "deputies" else "Senat"
    outcome = vote.get("outcome")
    verdict = {"adoptat": "ADOPTAT ✅", "respins": "RESPINS ❌"}.get(outcome, "")
    fc, ac, bc = vote.get("for_count") or 0, vote.get("against_count") or 0, vote.get("abstention_count") or 0
    link = f"{cfg.site_url}/votes/{vote['id']}"

    lines = [
        f"{code} · {chamber}",
        "",
        title,
    ]
    if verdict:
        lines += ["", verdict]
    lines += [
        f"🟢 {fc} pentru   🔴 {ac} împotrivă   🟣 {bc} abțineri",
        "",
        f"Detalii și voturi individuale: {link}",
        "",
        "#parlament #politicaRomânească #votRO #transparență #românia",
    ]
    return "\n".join(lines)


# ── Instagram Graph API ───────────────────────────────────────────────────────
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
    ap.add_argument("--verify", action="store_true", help="check the access token / account")
    ap.add_argument("--vote", help="vote id to build and publish a post for")
    ap.add_argument("--image-url", help="post an arbitrary image URL (with --caption)")
    ap.add_argument("--caption", help="caption for --image-url")
    ap.add_argument("--dry-run", action="store_true", help="print instead of publishing")
    args = ap.parse_args()

    if args.verify:
        print(verify_token(cfg))
        return
    if args.vote:
        post_vote(cfg, args.vote, dry_run=args.dry_run)
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
