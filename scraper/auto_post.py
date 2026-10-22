"""Autopilot for the Instagram grid — publishes the slots due today and pings
the owner after each post.

Allowed by the owner on 2026-10-10 («i am allowing you to post by yourself, i
just want to get a ping when u do»). Before that nothing ever auto-published.
What stays manual: the Thursday explainer (editorial writing) and the
quarterly matrix. Every ranking that names people keeps the three guards
(seated the whole window, no context_note, minimum votes held) — they live in
the og routes / _interval_absences, not here.

Runs from the VPS three times a day (12:05, 18:05, 20:05 RO — see
deploy/votro-autopost.timer); each run publishes the slots whose time has
passed and that were not posted yet today (ig_posts.jsonl is the ledger; law
carousels are also deduped by law id, forever).

Usage:
    python auto_post.py [--date YYYY-MM-DD] [--slot <id>] [--dry-run] [--force]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import traceback
from pathlib import Path

import requests
from dotenv import load_dotenv

import instagram_poster as ig
import post_check
from post_schedule import DB, WEEKDAYS_RO, contested_votes, due, finished_laws, load_schedule, tacit_soon

HASHTAGS = "#parlament #laButoane"
LEDGER = Path(os.environ.get("VOTRO_LOG_DIR", "/var/log/votro")) / "ig_posts.jsonl"
# the weekly absence story embeds a SIGNED shamecard in the story frame; that
# needs the frame's URL re-encoding fix (og/story card.toString()) live, or the
# card falls back to all-time. Flip once the frontend deploy is confirmed.

def weekly_absents_enabled() -> bool:
    # read at call time: main() loads .env after import, so a module-level
    # constant always saw it unset and the weekly story never ran
    return os.environ.get("AUTOPOST_WEEKLY_ABSENTS") == "1"
CHECK_IN_DRY = False  # --dry-run --check runs post_check too (costs an API call per post)


# ── ledger ──────────────────────────────────────────────────────────────────
def ledger_rows() -> list[dict]:
    if not LEDGER.exists():
        return []
    return [json.loads(l) for l in LEDGER.read_text(encoding="utf-8").splitlines() if l.strip()]


def already(rows: list[dict], day: str, slot: str, key: str | None = None) -> bool:
    return any(r["date"] == day and r["slot"] == slot and (key is None or r.get("key") == key) for r in rows)


def posted_law_ids(rows: list[dict]) -> set[str]:
    return {r["key"] for r in rows if r["slot"] in ("law-finished-1", "backlog") and r.get("key")}


def record(day: str, slot: str, key: str | None, media_id: str, kind: str, title: str) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"date": day, "slot": slot, "key": key, "media_id": media_id, "kind": kind,
                            "title": title, "at": dt.datetime.now(dt.timezone.utc).isoformat()}, ensure_ascii=False) + "\n")


# ── notification ────────────────────────────────────────────────────────────
def permalink(cfg: ig.Config, media_id: str) -> str | None:
    try:
        r = requests.get(f"https://graph.instagram.com/{cfg.version}/{media_id}",
                         params={"fields": "permalink", "access_token": cfg.token}, timeout=30)
        return r.json().get("permalink")
    except Exception:
        return None


def ig_dm(cfg: ig.Config, text: str) -> bool:
    """Instagram DM to the owner (IG_PING_USERNAME, e.g. siminiucdenis) from
    @la.butoane. Instagram only lets a business account message someone who
    wrote to it first, and only within 24 h of their last message — so this
    works as long as the owner replies to the pings now and then; otherwise it
    fails quietly and the email goes out instead."""
    who = os.environ.get("IG_PING_USERNAME")
    if not who:
        return False
    try:
        conv = requests.get(f"https://graph.instagram.com/{cfg.version}/me/conversations",
                            params={"platform": "instagram", "fields": "participants", "access_token": cfg.token},
                            timeout=30).json()
        rid = None
        for c in conv.get("data", []):
            for p in (c.get("participants") or {}).get("data", []):
                if p.get("username", "").lower() == who.lower():
                    rid = p["id"]
        if not rid:
            print(f"ig dm: no conversation with @{who} yet — they must DM the account first", file=sys.stderr)
            return False
        r = requests.post(f"https://graph.instagram.com/{cfg.version}/me/messages",
                          json={"recipient": {"id": rid}, "message": {"text": text[:950]}},
                          params={"access_token": cfg.token}, timeout=30)
        if not r.ok:
            print(f"ig dm failed ({r.status_code}): {r.text[:200]}", file=sys.stderr)
            return False
        return True
    except Exception as e:
        print(f"ig dm error: {e}", file=sys.stderr)
        return False


def notify(subject: str, text: str, cfg: ig.Config | None = None) -> None:
    """Instagram DM first (when IG_PING_USERNAME is set and the 24 h window is
    open), then email (Resend) and Telegram (when configured)."""
    sent = []
    if cfg and ig_dm(cfg, f"{subject}\n{text}"):
        sent.append("instagram dm")
    key, to = os.environ.get("RESEND_API_KEY"), os.environ.get("IG_PREVIEW_EMAIL")
    if key and to:
        try:
            requests.post("https://api.resend.com/emails",
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                          json={"from": os.environ.get("NEWSLETTER_FROM", "LaButoane <newsletter@resend.dev>"),
                                "to": [to], "subject": subject,
                                "html": "<pre style='font-family:-apple-system,Segoe UI,sans-serif;white-space:pre-wrap'>"
                                        + ig._html.escape(text) + "</pre>"}, timeout=30).raise_for_status()
            sent.append("email")
        except Exception as e:
            print(f"notify email failed: {e}", file=sys.stderr)
    tok, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if tok and chat:
        try:
            requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                          json={"chat_id": chat, "text": f"{subject}\n{text}", "disable_web_page_preview": False},
                          timeout=30).raise_for_status()
            sent.append("telegram")
        except Exception as e:
            print(f"notify telegram failed: {e}", file=sys.stderr)
    print(f"notified via {', '.join(sent) or 'nothing (no channel configured)'}")


# ── pre-publish check ───────────────────────────────────────────────────────
class Blocked(Exception):
    """post_check refused the post; main() pings the owner and moves on."""


def vet(cfg: ig.Config, dry: bool, kind: str, urls: list[str], caption: str, title: str, facts: dict,
        texts: list[dict] | None = None) -> None:
    """Run post_check: the slides IG will fetch (stories: the 9:16 frame) must
    load — doubles as the pre-warm — and the text going onto them (`texts`,
    one dict per slide) is read by Claude with the caption. Raises Blocked on
    a mechanical failure, or on an AI failure in enforce mode; in log mode an
    AI failure only pings."""
    if dry and not CHECK_IN_DRY:
        return
    if kind == "story":
        urls = [u if ig.is_native_story(u) else f"{cfg.site_url}/api/og/story?src={ig._quote(u, safe='')}" for u in urls]
    v = post_check.review(kind, urls, caption, texts or [], facts)
    if v.ok:
        print(f"  check ok{' (AI off)' if v.unchecked else ''}")
        return
    why = "\n".join("• " + p for p in v.problems)
    if v.mechanical or post_check.mode() == "enforce":
        raise Blocked(f"{title}\n{why}")
    print("  check would block (log mode, publishing anyway):", why, sep="\n")
    if not dry:
        notify(f"[LaButoane] ⚠ verificarea ar fi blocat: {title}"[:120],
               f"{why}\n\nMod log: postarea a plecat oricum. Dacă e o alarmă falsă, nu face nimic.", cfg)


def law_texts(db: DB, law_ids: list[str]) -> list[dict]:
    """What a law card shows, straight from the DB (law_status + headline), in
    the order given — the text the check reads instead of the rendered image."""
    if not law_ids:
        return []
    ids = ",".join(law_ids)
    st = {r["law_id"]: r for r in db.get("law_status", select="law_id,code,title,summary",
                                         law_id=f"in.({ids})", limit="50")}
    hl = {r["id"]: r.get("headline") for r in db.get("laws", select="id,headline", id=f"in.({ids})", limit="50")}
    return [{**{k: v for k, v in st.get(i, {}).items() if k != "law_id"}, "headline": hl.get(i)} for i in law_ids]


# ── helpers ─────────────────────────────────────────────────────────────────
def ro_now() -> dt.datetime:
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("Europe/Bucharest"))
    except Exception:
        return dt.datetime.now()


def slot_minutes(s: dict) -> int:
    t = s.get("time", "")
    if t[:2].isdigit() and ":" in t:
        h, m = t.split(":")
        return int(h) * 60 + int(m)
    if "ședință" in t:
        return 20 * 60      # after the plenary: the 20:05 run
    return 12 * 60          # «în ziua anunțului» etc.: the noon run


def chamber_ro(ch: str) -> str:
    return "Senat" if ch == "senate" else "Cameră"


def tally(v: dict) -> str:
    if v.get("against_count") is None:
        return f"{v['for_count']} pentru"
    return f"{v['for_count']}–{v['against_count']}"


def week_final_votes(db: DB, monday: dt.date, sunday: dt.date) -> list[dict]:
    rows = db.get("votes", select="id,vote_date,chamber,for_count,against_count,abstention_count,outcome,laws(id,code,title,headline,explainer,interest_score)",
                  vote_type="eq.vot final", law_id="not.is.null",
                  **{"and": f"(vote_date.gte.{monday},vote_date.lte.{sunday})"}, order="vote_date", limit="500")
    return [r for r in rows if r.get("laws")]


# ── slot handlers (each returns (media_id, kind, title, key) or None) ───────
def do_story_sitting(cfg, db, day, dry):
    votes = db.get("votes", select="id,chamber,for_count,against_count,outcome,laws(id,code,headline,interest_score)",
                   vote_type="eq.vot final", law_id="not.is.null", vote_date=f"eq.{day}", limit="200")
    votes = [v for v in votes if v.get("laws")]
    # stories are for votes in ONE chamber; a vote that finished a law (both chambers
    # now voted) goes to the feed instead — «Trecute azi de Parlament» / «Respinse definitiv»
    st = statuses(db, [v["laws"]["id"] for v in votes])
    votes = [v for v in votes if not (st.get(v["laws"]["id"]) or {}).get("camera_outcome" if v["chamber"] == "senate" else "senate_outcome")]
    if not votes:
        return []
    votes.sort(key=lambda v: -((v["laws"].get("interest_score") or 0)))
    out = []
    for v in votes[:5]:
        url = f"{cfg.site_url}/api/og/votestory?vote={v['id']}&v={ig.CARD_V}"
        title = f"story vot: {v['laws']['code']} · {chamber_ro(v['chamber'])} {tally(v)} {v['outcome']}"
        try:
            vet(cfg, dry, "story", [url], "", title,
                {"date": day, "law": v["laws"]["code"], "headline": v["laws"].get("headline"),
                 "chamber": chamber_ro(v["chamber"]), "for": v["for_count"], "against": v["against_count"],
                 "outcome": v["outcome"]},
                [{"slide": "vote card", **law_texts(db, [v["laws"]["id"]])[0]}] if v["laws"].get("id") else None)
        except Blocked as e:  # one bad card must not stop the other stories
            notify("[LaButoane] ✗ blocat de verificare: story vot", str(e), cfg); continue
        if dry:
            print("  would story:", url); continue
        try:  # one failed story must not lose the ones already published (they'd go unrecorded)
            out.append((ig.post_story(cfg, url), "story", title, v["id"]))
        except Exception as e:
            traceback.print_exc()
            notify("[LaButoane] ✗ story eșuat: " + v["laws"]["code"], f"{day} · {title}\n{type(e).__name__}: {str(e)[:300]}", cfg)
    return out


def do_story_switch(cfg, db, day, dry):
    rows = db.get("politician_party_history", select="politician_id", from_date=f"eq.{day}", limit="20")
    if not rows:
        return []
    url = f"{cfg.site_url}/api/og/switchcard?month={day[:7]}&v={len(rows)}{day}"
    title = f"story traseiști: {len(rows)} schimbare/schimbări azi"
    vet(cfg, dry, "story", [url], "", title, {"month": day[:7], "switches_today": len(rows)})
    if dry:
        print("  would story:", url); return []
    return [(ig.post_story(cfg, url), "story", title, day)]


def do_recap_week(cfg, db, day, dry):
    d = dt.date.fromisoformat(day)
    monday = d - dt.timedelta(days=d.isoweekday() - 1 + 7)
    sunday = monday + dt.timedelta(days=6)
    votes = week_final_votes(db, monday, sunday)
    if not votes:
        return []
    adopted = [v for v in votes if v["outcome"] == "adoptat"]
    rejected = [v for v in votes if v["outcome"] == "respins"]
    # one slide per law (a law can have two final votes in a week) — top 9 adopted by interest
    seen, slides_laws = set(), []
    for v in sorted(adopted, key=lambda v: -(v["laws"].get("interest_score") or 0)):
        if v["laws"]["id"] in seen:
            continue
        seen.add(v["laws"]["id"]); slides_laws.append(v)
    shown = slides_laws[:9]
    # v2: the cover lists every law (ids, slide order); each slide says what happened that week
    slides = [f"{cfg.site_url}/api/og/weekcover?kind=votate&n={len(slides_laws)}&ids={','.join(v['laws']['id'] for v in shown)}&v={ig.CARD_V}{day}"] + \
             [f"{cfg.site_url}/api/og/recapcard?id={v['laws']['id']}&kind=votate&pos={i}/{len(shown) + 1}"
              f"&ch={v['chamber']}&out={v['outcome']}&t={v['for_count']}-{v['against_count']}&d={v['vote_date']}&v={ig.CARD_V}"
              for i, v in enumerate(shown, 2)]
    rng = f"{monday.day} {ig_month(monday)} – {sunday.day} {ig_month(sunday)}"
    chambers = {v["chamber"] for v in votes}
    lines = [f"Ce a votat Parlamentul săptămâna trecută ({rng})", ""]
    if len(chambers) == 1:
        lines.append(f"Doar {'Senatul' if 'senate' in chambers else 'Camera Deputaților'} a avut voturi finale. ")
    lines.append(f"{len(adopted)} adoptate:" if adopted else "Niciun vot final adoptat.")
    for v in adopted:
        l = v["laws"]; lines.append(f"• {law_line(l)} ({l['code']}, {chamber_ro(v['chamber'])}, {tally(v)})")
    if rejected:
        lines += ["", f"{len(rejected)} respinse:"]
        for v in rejected:
            l = v["laws"]; lines.append(f"• {law_line(l)} ({l['code']}, {chamber_ro(v['chamber'])}, {v['for_count']}–{v['against_count']}–{v['abstention_count']})")
    lines += ["", "Un vot final nu înseamnă încă lege. Urmează cealaltă cameră sau Președintele. Fiecare e explicată pe la-butoane.ro, link în bio.", "", HASHTAGS]
    caption = ig.fit_caption("\n".join(lines))
    title = f"recap {rng}: {len(adopted)} adoptate, {len(rejected)} respinse"
    # vet() also pre-warms: IG's fetcher 400s on a cold render
    vet(cfg, dry, "feed", slides, caption, title,
        {"week": f"{monday} – {sunday}", "adopted": len(adopted), "rejected": len(rejected),
         "slides_after_cover": [v["laws"]["code"] for v in slides_laws[:9]]},
        [{"slide": 1, "card": "cover", "laws_listed": min(len(slides_laws), 9), "count": len(slides_laws),
          "cover_lists_codes": [v["laws"]["code"] for v in slides_laws[:9]], "label": "legi cu vot final adoptat", "week": f"{monday} – {sunday}",
          "note": "the cover lists the first laws and says «și încă N în descriere» for the rest; the caption lists every vote",
          "caption_only_by_design": [v["laws"]["code"] for v in slides_laws[9:]]}]
        + [{"slide": i, **t} for i, t in enumerate(law_texts(db, [v["laws"]["id"] for v in slides_laws[:9]]), 2)])
    if dry:
        print("  would carousel:", *slides, sep="\n    "); print(caption[:400]); return []
    mid = ig.post_carousel(cfg, slides, caption) if len(slides) > 1 else ig.post_image(cfg, slides[0], caption)
    return [(mid, "feed", title, f"{monday}")]


def law_line(l: dict) -> str:
    """How a law reads in a caption list: the explainer's title (read from the
    final text), else the AI headline, else the start of the official title."""
    ex = l.get("explainer") or {}
    if ex.get("titlu") or l.get("headline"):
        return ex.get("titlu") or l["headline"]
    t = l["title"].strip()
    return t if len(t) <= 90 else t[:90].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def ig_month(d: dt.date) -> str:
    return ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"][d.month - 1]


LAWS_PER_DAY = 2  # every interesting finished law gets its own carousel; the rest wait their turn


def do_law_finished(cfg, db, day, dry, rows):
    d = dt.date.fromisoformat(day)
    done = posted_law_ids(rows)
    out = []
    for l in finished_laws(db, d - dt.timedelta(days=21)):
        if len(out) >= LAWS_PER_DAY:
            break
        if l["id"] in done or (l.get("interest_score") or 0) < 50:
            continue
        title = f"lege: {l['code']} — {l.get('headline') or l['title'][:80]}"
        suffixes, caption = ig._law_slides(cfg, l["id"])
        vet(cfg, dry, "feed", [ig._slide_url(cfg, s, False) for s in suffixes], caption, title,
            {"law": l["code"], "headline": l.get("headline"), "presidential_status": l.get("presidential_status")},
            [{"slides": [x.split("?")[0] for x in suffixes], **law_texts(db, [l["id"]])[0]}])
        if dry:
            print(f"  would post law carousel: {l['code']} ({l.get('interest_score')}) {l.get('headline')}"); out.append(None); continue
        mid = ig.post_law(cfg, l["id"])
        if mid:
            out.append((mid, "feed", title, l["id"]))
    return [o for o in out if o]


def do_tacit(cfg, db, day, dry):
    bills = tacit_soon(db, dt.date.fromisoformat(day), 60)
    if not bills:
        return []
    url = f"{cfg.site_url}/api/og/tacitlist?d={day}&v={ig.CARD_V}"
    lines = ["Legi care pot trece tacit, fără niciun vot", "",
             "Dacă termenul constituțional expiră fără vot, proiectul e considerat adoptat automat de prima cameră (art. 75). Expiră în următoarele 7 zile:", ""]
    for i, b in enumerate(bills, 1):
        text = (b.get("summary") or b["code"]).strip()
        if len(text) > 140:  # cut at a word, never mid-word («susține un ex»)
            text = text[:140].rsplit(" ", 1)[0].rstrip(",;:") + "…"
        lines.append(f"{i}. {text} ({b['code']}), termen {b['tacit_deadline']}")
    lines += ["", "Lista completă e pe la-butoane.ro/tacite, link în bio.", "", HASHTAGS]
    title = f"tacit: {len(bills)} proiecte"
    vet(cfg, dry, "feed", [url], "\n".join(lines), title,
        {"date": day, "bills": [{"code": b["code"], "deadline": b["tacit_deadline"]} for b in bills]},
        [{"slide": 1, "card": "tacit list", "rows": [{"code": b["code"], "deadline": b["tacit_deadline"], "summary": b.get("summary")} for b in bills]}])
    if dry:
        print("  would post:", url); return []
    return [(ig.post_image(cfg, url, "\n".join(lines)), "feed", title, day)]


def do_passed_week(cfg, db, day, dry):
    d = dt.date.fromisoformat(day)
    laws = finished_laws(db, d - dt.timedelta(days=7))
    if not laws:
        return []
    shown = laws[:9]
    slides = [f"{cfg.site_url}/api/og/weekcover?kind=parlament&n={len(laws)}&ids={','.join(l['id'] for l in shown)}&v={ig.CARD_V}{day}"] + \
             [f"{cfg.site_url}/api/og/recapcard?id={l['id']}&kind=parlament&pos={i}/{len(shown) + 1}&v={ig.CARD_V}"
              for i, l in enumerate(shown, 2)]
    lines = ["Trecute de Parlament săptămâna asta, acum la Președinte sau deja promulgate", ""]
    for l in laws:
        st = {"promulgat": "promulgată", "retrimis": "retrimisă la Parlament", "sesizat_ccr": "contestată la CCR"}.get(l.get("presidential_status") or "", "la Președinte")
        lines.append(f"• {law_line(l)} ({l['code']}, {st})")
    lines += ["", "Fiecare e explicată pe la-butoane.ro, link în bio.", "", HASHTAGS]
    title = f"trecute de Parlament: {len(laws)} legi"
    vet(cfg, dry, "feed", slides, "\n".join(lines), title,
        {"week_ending": day, "laws": len(laws), "slides_after_cover": [l["code"] for l in laws[:9]]},
        [{"slide": 1, "card": "cover", "count": len(laws), "laws_listed": len(shown),
          "cover_lists_codes": [l["code"] for l in shown],
          "note": "the cover lists the first laws and says «și încă N în descriere» for the rest; the caption lists all",
          "caption_only_by_design": [l["code"] for l in laws[9:]]}]
        + [{"slide": i, **t} for i, t in enumerate(law_texts(db, [l["id"] for l in laws[:9]]), 2)])
    if dry:
        print("  would carousel:", *slides, sep="\n    "); return []
    mid = ig.post_carousel(cfg, slides, "\n".join(lines)) if len(slides) > 1 else ig.post_image(cfg, slides[0], "\n".join(lines))
    return [(mid, "feed", title, f"{d}")]


def posted_keys(rows: list[dict], slot: str) -> set[str]:
    """Every law id ever posted under `slot` (a carousel's key is its ids joined by commas)."""
    return {k for r in rows if r["slot"] == slot for k in (r.get("key") or "").split(",") if k}


def chunks(items: list, size: int = 9) -> list[list]:
    """Split into the fewest carousels of ≤ size, as equal as possible (14 → 7 + 7, not 9 + 5)."""
    if not items:
        return []
    n = -(-len(items) // size)
    per = -(-len(items) // n)
    return [items[i:i + per] for i in range(0, len(items), per)]


def statuses(db: DB, law_ids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(0, len(law_ids), 80):
        for r in db.get("law_status", select="law_id,code,senate_outcome,senate_vote_date,camera_outcome,camera_vote_date,presidential_status,presidential_date",
                        law_id=f"in.({','.join(law_ids[i:i + 80])})", limit="100"):
            out[r["law_id"]] = r
    return out


def laws_by_id(db: DB, ids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(0, len(ids), 80):
        for r in db.get("laws", select="id,code,title,headline,explainer,interest_score,presidential_status,presidential_date",
                        id=f"in.({','.join(ids[i:i + 80])})", limit="100"):
            out[r["id"]] = r
    return out


def post_law_carousels(cfg, db, day, dry, slot: str, laws: list[dict], kind: str, header: str, footer: str,
                       line, slide_q=lambda l: "") -> list:
    """One carousel per ≤9 laws (split evenly): a cover listing them + one recap slide each."""
    out = []
    parts = chunks(laws)
    for p_i, part in enumerate(parts, 1):
        ids = [l["id"] for l in part]
        tag = f" (partea {p_i} din {len(parts)})" if len(parts) > 1 else ""
        slides = [f"{cfg.site_url}/api/og/weekcover?kind={kind}&n={len(part)}&ids={','.join(ids)}&v={ig.CARD_V}{day}"] + \
                 [f"{cfg.site_url}/api/og/recapcard?id={l['id']}&kind={kind}&pos={i}/{len(part) + 1}{slide_q(l)}&v={ig.CARD_V}"
                  for i, l in enumerate(part, 2)]
        lines = [header + tag, ""] + [line(l) for l in part] + ["", footer, "", HASHTAGS]
        caption = ig.fit_caption("\n".join(lines))
        title = f"{header.lower()}{tag}: {len(part)} legi"
        try:
            vet(cfg, dry, "feed", slides, caption, title,
                {"date": day, "laws": [l["code"] for l in part]},
                [{"slide": 1, "card": "cover", "kind": kind, "cover_lists_codes": [l["code"] for l in part]}]
                + [{"slide": i, **t} for i, t in enumerate(law_texts(db, ids), 2)])
        except Blocked as e:
            notify(f"[LaButoane] ✗ blocat de verificare: {title}"[:120], str(e), cfg); continue
        if dry:
            print("  would carousel:", *slides, sep="\n    "); print(caption[:300]); continue
        out.append((ig.post_carousel(cfg, slides, caption), "feed", title, ",".join(ids)))
    return out


def do_parliament_today(cfg, db, day, dry, rows):
    """Laws that passed BOTH chambers (the decisional vote happened in the last 3 days, not posted yet)."""
    d = dt.date.fromisoformat(day)
    votes = db.get("votes", select="law_id,chamber,vote_date", vote_type="eq.vot final", outcome="eq.adoptat",
                   law_id="not.is.null", **{"and": f"(vote_date.gte.{d - dt.timedelta(days=2)},vote_date.lte.{day})"}, limit="300")
    ids = sorted({v["law_id"] for v in votes} - posted_keys(rows, "parliament-today"))
    st = statuses(db, ids)
    done = [i for i in ids if st.get(i) and st[i]["senate_outcome"] == "adoptat" and st[i]["camera_outcome"] == "adoptat"
            and not (st[i]["code"] or "").startswith("PH")]
    if not done:
        return []
    laws = sorted(laws_by_id(db, done).values(), key=lambda l: -(l.get("interest_score") or 0))
    return post_law_carousels(cfg, db, day, dry, "parliament-today", laws, "parlament",
                              "Trecute azi de Parlament",
                              "Au trecut de ambele camere. Urmează Președintele, care are 20 de zile să le promulge sau să le retrimită. Fiecare e explicată pe la-butoane.ro, link în bio.",
                              lambda l: f"• {law_line(l)} ({l['code']})")


def do_president_today(cfg, db, day, dry, rows):
    """The President's decisions of the last 3 days (promulgated / returned / sent to the CCR), not posted yet."""
    d = dt.date.fromisoformat(day)
    laws = db.get("laws", select="id,code,title,headline,explainer,interest_score,presidential_status,presidential_date",
                  presidential_status="in.(promulgat,retrimis,sesizat_ccr)", presidential_date=f"gte.{d - dt.timedelta(days=3)}", limit="100")
    seen = posted_keys(rows, "president-today")
    laws = sorted([l for l in laws if l["id"] not in seen], key=lambda l: -(l.get("interest_score") or 0))
    if not laws:
        return []
    word = {"promulgat": "promulgată", "retrimis": "retrimisă Parlamentului", "sesizat_ccr": "trimisă la CCR"}
    return post_law_carousels(cfg, db, day, dry, "president-today", laws, "presedinte",
                              "Ce a decis Președintele",
                              "O lege promulgată intră în vigoare după publicarea în Monitorul Oficial. Fiecare e explicată pe la-butoane.ro, link în bio.",
                              lambda l: f"• {law_line(l)} ({l['code']}, {word[l['presidential_status']]})")


def do_rejected_week(cfg, db, day, dry, rows):
    """Laws rejected for good this week: the second chamber voted them down (Mon–today)."""
    d = dt.date.fromisoformat(day)
    monday = d - dt.timedelta(days=d.isoweekday() - 1)
    votes = db.get("votes", select="law_id,chamber,vote_date,for_count,against_count", vote_type="eq.vot final", outcome="eq.respins",
                   law_id="not.is.null", **{"and": f"(vote_date.gte.{monday},vote_date.lte.{day})"}, limit="200")
    seen = posted_keys(rows, "rejected-week")
    st = statuses(db, sorted({v["law_id"] for v in votes}))
    final = {}
    for v in votes:
        s_ = st.get(v["law_id"]) or {}
        other = s_.get("camera_outcome" if v["chamber"] == "senate" else "senate_outcome")
        if other and v["law_id"] not in seen:  # the other chamber had voted already: this one decided
            final[v["law_id"]] = v
    if not final:
        return []
    meta = laws_by_id(db, list(final))
    laws = sorted(meta.values(), key=lambda l: -(l.get("interest_score") or 0))
    q = lambda l: (f"&ch={final[l['id']]['chamber']}&out=respins&t={final[l['id']]['for_count']}-{final[l['id']]['against_count']}"
                   f"&d={final[l['id']]['vote_date']}")
    return post_law_carousels(cfg, db, day, dry, "rejected-week", laws, "respinse",
                              "Respinse definitiv de Parlament săptămâna asta",
                              "Respinse de a doua cameră, după votul primei camere: nu mai pot deveni lege în forma asta. Detalii pe la-butoane.ro, link în bio.",
                              lambda l: f"• {law_line(l)} ({l['code']}, {chamber_ro(final[l['id']]['chamber'])} {final[l['id']]['for_count']}–{final[l['id']]['against_count']})",
                              q)


EVERGREEN = [
    ("edu", 6, "Cum devine un proiect lege? Pas cu pas, de la idee până în Monitorul Oficial. Plus excepția prin care o lege trece fără niciun vot."),
    ("majority", 5, "De ce poate pica o lege fără niciun vot împotrivă? Pragul pentru o lege ordinară e majoritatea celor prezenți, nu «mai mulți pentru decât contra»."),
    ("structura", 4, "Cine stă la butoane? 464 de mandate, Senatul și Camera Deputaților, partid cu partid."),
]


def do_explainer(cfg, db, day, dry, rows):
    """Thursday: the week's most contested vote that FINISHED a law (≥3 MPs voted
    against their party line) as a carousel ending on the deviation slide; with
    none, an evergreen explainer deck not posted in the last 8 weeks."""
    d = dt.date.fromisoformat(day)
    seen = posted_keys(rows, "explainer")
    for v in contested_votes(db, d - dt.timedelta(days=7)):
        law = v.get("laws") or {}
        if v["deviations"] < 3:
            break
        vote_law = db.get("votes", select="law_id", id=f"eq.{v['id']}", limit="1")
        law_id = vote_law[0]["law_id"] if vote_law else None
        st = statuses(db, [law_id]).get(law_id) if law_id else None
        other = (st or {}).get("camera_outcome" if v["chamber"] == "senate" else "senate_outcome")
        if not law_id or not other or law_id in seen:
            continue  # a one-chamber vote stays a story (feed = finished laws only)
        meta = laws_by_id(db, [law_id])[law_id]
        ex = meta.get("explainer") or {}
        has_hook = bool(ex.get("titlu") or meta.get("headline"))
        slides = ([f"{cfg.site_url}/api/og/hookcard?id={law_id}&v={ig.CARD_V}"] if has_hook else []) + [
            f"{cfg.site_url}/api/og/summarycard?id={law_id}{'&nohl=1' if has_hook else ''}&v={ig.CARD_V}",
            f"{cfg.site_url}/api/og/votecard?vote={v['id']}&v={ig.CARD_V}",
            f"{cfg.site_url}/api/og/deviationcard?vote={v['id']}&v={ig.CARD_V}"]
        n = v["deviations"]
        lines = [law_line(meta), "",
                 f"{n} parlamentari au votat altfel decât majoritatea propriului partid.", ""]
        if ex.get("rezumat"):
            lines += [ex["rezumat"], ""]
        lines += [f"{chamber_ro(v['chamber'])}, {v['vote_date']}: {v['for_count']} pentru, {v['against_count']} împotrivă, "
                  f"{v['abstention_count'] or 0} abțineri. Pe ultimul slide, cine a votat altfel.", "",
                  f"Lege: {meta['code']}. Detalii pe la-butoane.ro, link în bio.", "", HASHTAGS]
        caption = ig.fit_caption("\n".join(lines))
        title = f"vot contestat: {meta['code']} ({n} devieri)"
        vet(cfg, dry, "feed", slides, caption, title,
            {"law": meta["code"], "deviations": n, "vote": {"for": v["for_count"], "against": v["against_count"]}},
            [{"slide": "law", **law_texts(db, [law_id])[0]}])
        if dry:
            print("  would carousel:", *slides, sep="\n    "); return []
        return [(ig.post_carousel(cfg, slides, caption), "feed", title, law_id)]

    # evergreen fallback: the deck posted longest ago (never within 8 weeks)
    recent = {r.get("key") for r in rows if r["slot"] == "explainer"
              and r["date"] >= str(d - dt.timedelta(weeks=8))}
    for deck, n, text in EVERGREEN:
        if f"deck:{deck}" in recent:
            continue
        slides = [f"{cfg.site_url}/api/og/{deck}?slide={i}&v={ig.CARD_V}" for i in range(1, n + 1)]
        caption = f"{text}\n\nToate voturile, explicate, pe la-butoane.ro. Link în bio.\n\n{HASHTAGS}"
        title = f"explainer: {deck}"
        vet(cfg, dry, "feed", slides, caption, title, {"deck": deck, "slides": n}, [])
        if dry:
            print("  would carousel:", *slides, sep="\n    "); return []
        return [(ig.post_carousel(cfg, slides, caption), "feed", title, f"deck:{deck}")]
    print("  every explainer deck ran in the last 8 weeks and no contested final vote: skip")
    return []


def do_absents_week(cfg, db, day, dry):
    if not weekly_absents_enabled():
        print("  weekly absence story disabled until the story-frame deploy is confirmed (AUTOPOST_WEEKLY_ABSENTS=1)")
        return []
    d = dt.date.fromisoformat(day)
    monday = d - dt.timedelta(days=d.isoweekday() - 1)
    url, _caption, warnings = ig._shame_interval(cfg, str(monday), str(d - dt.timedelta(days=1)))
    if warnings:
        print("  skipped — sanity warnings:", *warnings, sep="\n    "); return []
    vet(cfg, dry, "story", [url], "", "absenții săptămânii",
        {"window": f"{monday} – {d - dt.timedelta(days=1)}", "ranking": "absențe la voturile din plen, săptămâna curentă"})
    if dry:
        print("  would story:", url[:120]); return []
    return [(ig.post_story(cfg, url), "story", "absenții săptămânii", str(monday))]


def do_absents_month(cfg, db, day, dry):
    prev = (dt.date.fromisoformat(day).replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
    url = f"{cfg.site_url}/api/og/shamecard?month={prev}&v={day}"
    vet(cfg, dry, "story", [url], "", f"absențe {prev}", {"month": prev, "ranking": "absențe la voturile din plen, luna trecută"})
    if dry:
        print("  would story:", url); return []
    return [(ig.post_story(cfg, url), "story", f"absențe {prev}", prev)]


def do_switchers_month(cfg, db, day, dry):
    prev = (dt.date.fromisoformat(day).replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
    rows = db.get("politician_party_history", select="politician_id",
                  **{"and": f"(from_date.gte.{prev}-01,from_date.lte.{prev}-31)"}, limit="50")
    if not rows:
        print("  no switches last month — skip"); return []
    url = f"{cfg.site_url}/api/og/switchcard?month={prev}&v={len(rows)}"
    vet(cfg, dry, "story", [url], "", f"traseiști {prev}", {"month": prev, "switches": len(rows)})
    if dry:
        print("  would story:", url); return []
    return [(ig.post_story(cfg, url), "story", f"traseiști {prev}: {len(rows)}", prev)]


HANDLERS = {
    "story-sitting": lambda c, d, day, dry, rows: do_story_sitting(c, d, day, dry),
    "story-switch": lambda c, d, day, dry, rows: do_story_switch(c, d, day, dry),
    "recap-week": lambda c, d, day, dry, rows: do_recap_week(c, d, day, dry),
    "parliament-today": do_parliament_today,
    "president-today": do_president_today,
    "rejected-week": do_rejected_week,
    "explainer": do_explainer,
    "law-finished-1": do_law_finished,
    "backlog": do_law_finished,
    "tacit-countdown": lambda c, d, day, dry, rows: do_tacit(c, d, day, dry),
    "passed-week": lambda c, d, day, dry, rows: do_passed_week(c, d, day, dry),
    "story-absents-week": lambda c, d, day, dry, rows: do_absents_week(c, d, day, dry),
    "absents-month": lambda c, d, day, dry, rows: do_absents_month(c, d, day, dry),
    "switchers-month": lambda c, d, day, dry, rows: do_switchers_month(c, d, day, dry),
    # "matrix-quarter": manual — the 09:00 digest reminds
}


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Instagram autopilot")
    ap.add_argument("--date", help="YYYY-MM-DD (default: today, Europe/Bucharest)")
    ap.add_argument("--slot", help="only this slot id")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true", help="ignore the time-of-day gate")
    ap.add_argument("--check", action="store_true", help="with --dry-run: run the pre-publish check too")
    args = ap.parse_args()
    global CHECK_IN_DRY
    CHECK_IN_DRY = args.check

    now = ro_now()
    day = args.date or now.date().isoformat()
    d = dt.date.fromisoformat(day)
    schedule = load_schedule()
    cfg = ig.Config()
    db = DB()
    rows = ledger_rows()

    slots = due(d, schedule)
    switches = db.get("politician_party_history", select="politician_id", from_date=f"eq.{day}", limit="1")
    if switches:
        slots = [s for s in schedule["slots"] if s.get("event") == "switch"] + slots
    minutes_now = now.hour * 60 + now.minute if not args.date else 24 * 60
    print(f"{WEEKDAYS_RO[d.isoweekday() - 1]} {day} · {len(slots)} slot(s) due")
    posted = 0
    for s in slots:
        sid = s["id"]
        if args.slot and sid != args.slot:
            continue
        if sid not in HANDLERS:
            print(f"- {sid}: manual slot, skipped"); continue
        if not args.force and not args.date and slot_minutes(s) > minutes_now:
            print(f"- {sid}: not before {s['time']}"); continue
        if already(rows, day, sid) and sid != "story-sitting":
            print(f"- {sid}: already posted today"); continue
        print(f"- {sid}: {s['title']}")
        try:
            results = HANDLERS[sid](cfg, db, day, args.dry_run, rows)
        except Blocked as e:
            print(f"  blocked by check:\n{e}")
            if not args.dry_run:
                notify(f"[LaButoane] ✗ blocat de verificare: {s['title']}"[:120],
                       f"{day} · {sid}\n{e}\n\nNu s-a postat. Rulează din nou la următorul slot; altfel postează din /admin.", cfg)
            continue
        except Exception as e:
            traceback.print_exc()
            notify(f"[LaButoane] ✗ postare eșuată: {s['title']}", f"{day} · {sid}\n{type(e).__name__}: {str(e)[:400]}", cfg)
            continue
        for mid, kind, title, key in results:
            if already(rows, day, sid, key):
                continue
            record(day, sid, key, mid, kind, title)
            rows.append({"date": day, "slot": sid, "key": key})
            link = permalink(cfg, mid) if kind == "feed" else "story (24 h) — vezi în app"
            notify(f"[LaButoane] ✓ postat: {title}"[:120], f"{kind} · {s['title']}\n{link}", cfg)
            posted += 1
    print(f"done: {posted} post(s)")


if __name__ == "__main__":
    main()
