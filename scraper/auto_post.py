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
from post_schedule import DB, WEEKDAYS_RO, due, finished_laws, load_schedule, tacit_soon

HASHTAGS = "#parlament #transparență #românia #politică #laButoane"
LEDGER = Path(os.environ.get("VOTRO_LOG_DIR", "/var/log/votro")) / "ig_posts.jsonl"
# the weekly absence story embeds a SIGNED shamecard in the story frame; that
# needs the frame's URL re-encoding fix (og/story card.toString()) live, or the
# card falls back to all-time. Flip once the frontend deploy is confirmed.
WEEKLY_ABSENTS_ENABLED = os.environ.get("AUTOPOST_WEEKLY_ABSENTS") == "1"


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


def notify(subject: str, text: str) -> None:
    """Email (Resend, always) + Telegram (when TELEGRAM_BOT_TOKEN/CHAT_ID are set)."""
    sent = []
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
    rows = db.get("votes", select="id,vote_date,chamber,for_count,against_count,abstention_count,outcome,laws(id,code,title,headline,interest_score)",
                  vote_type="eq.vot final", law_id="not.is.null",
                  **{"and": f"(vote_date.gte.{monday},vote_date.lte.{sunday})"}, order="vote_date", limit="500")
    return [r for r in rows if r.get("laws")]


# ── slot handlers (each returns (media_id, kind, title, key) or None) ───────
def do_story_sitting(cfg, db, day, dry):
    votes = db.get("votes", select="id,chamber,for_count,against_count,outcome,laws(code,headline,interest_score)",
                   vote_type="eq.vot final", law_id="not.is.null", vote_date=f"eq.{day}", limit="200")
    votes = [v for v in votes if v.get("laws")]
    if not votes:
        return []
    votes.sort(key=lambda v: -((v["laws"].get("interest_score") or 0)))
    out = []
    for v in votes[:5]:
        url = f"{cfg.site_url}/api/og/votecard?vote={v['id']}&v={ig.CARD_V}"
        title = f"story vot: {v['laws']['code']} · {chamber_ro(v['chamber'])} {tally(v)} {v['outcome']}"
        if dry:
            print("  would story:", url); continue
        out.append((ig.post_story(cfg, url), "story", title, v["id"]))
    return out


def do_story_switch(cfg, db, day, dry):
    rows = db.get("politician_party_history", select="politician_id", from_date=f"eq.{day}", limit="20")
    if not rows:
        return []
    url = f"{cfg.site_url}/api/og/switchcard?month={day[:7]}&v={len(rows)}{day}"
    if dry:
        print("  would story:", url); return []
    return [(ig.post_story(cfg, url), "story", f"story traseiști: {len(rows)} schimbare/schimbări azi", day)]


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
    slides = [f"{cfg.site_url}/api/og/weekcover?kind=votate&n={len(adopted)}&v={ig.CARD_V}{day}"] + \
             [f"{cfg.site_url}/api/og/summarycard?id={v['laws']['id']}&v={ig.CARD_V}" for v in slides_laws[:9]]
    rng = f"{monday.day} {ig_month(monday)} – {sunday.day} {ig_month(sunday)}"
    chambers = {v["chamber"] for v in votes}
    lines = [f"🗳️ Ce a votat Parlamentul săptămâna trecută ({rng})", ""]
    if len(chambers) == 1:
        lines.append(f"Doar {'Senatul' if 'senate' in chambers else 'Camera Deputaților'} a avut voturi finale. ")
    lines.append(f"{len(adopted)} adoptate:" if adopted else "Niciun vot final adoptat.")
    for v in adopted:
        l = v["laws"]; lines.append(f"• {l['code']} — {l.get('headline') or l['title'][:90]} ({chamber_ro(v['chamber'])}, {tally(v)})")
    if rejected:
        lines += ["", f"{len(rejected)} respinse:"]
        for v in rejected:
            l = v["laws"]; lines.append(f"• {l['code']} — {l.get('headline') or l['title'][:90]} ({chamber_ro(v['chamber'])}, {v['for_count']}–{v['against_count']}–{v['abstention_count']})")
    lines += ["", "Un vot final nu înseamnă încă lege — urmează cealaltă cameră sau Președintele. Fiecare, explicată pe la-butoane.ro (link în bio)", "", HASHTAGS]
    caption = "\n".join(lines)
    if dry:
        print("  would carousel:", *slides, sep="\n    "); print(caption[:400]); return []
    for u in slides:
        requests.get(u, timeout=90)  # pre-warm: IG's fetcher 400s on a cold render
    mid = ig.post_carousel(cfg, slides, caption) if len(slides) > 1 else ig.post_image(cfg, slides[0], caption)
    return [(mid, "feed", f"recap {rng}: {len(adopted)} adoptate, {len(rejected)} respinse", f"{monday}")]


def ig_month(d: dt.date) -> str:
    return ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"][d.month - 1]


def do_law_finished(cfg, db, day, dry, rows):
    d = dt.date.fromisoformat(day)
    done = posted_law_ids(rows)
    for l in finished_laws(db, d - dt.timedelta(days=10)):
        if l["id"] in done or (l.get("interest_score") or 0) < 50:
            continue
        if dry:
            print(f"  would post law carousel: {l['code']} ({l.get('interest_score')}) {l.get('headline')}"); return []
        for u in [ig._slide_url(cfg, s, False) for s in ig._law_slides(cfg, l["id"])[0]]:
            requests.get(u, timeout=90)
        mid = ig.post_law(cfg, l["id"])
        return [(mid, "feed", f"lege: {l['code']} — {l.get('headline') or l['title'][:80]}", l["id"])] if mid else []
    return []


def do_tacit(cfg, db, day, dry):
    bills = tacit_soon(db, dt.date.fromisoformat(day), 60)
    if not bills:
        return []
    url = f"{cfg.site_url}/api/og/tacitlist?d={day}&v={ig.CARD_V}"
    lines = ["⏳ Legi pe cale să treacă TACIT — fără niciun vot", "",
             "Dacă termenul constituțional expiră fără vot, proiectul e considerat adoptat automat de prima cameră (art. 75). Expiră în următoarele 7 zile:", ""]
    for i, b in enumerate(bills, 1):
        lines.append(f"{i}. {(b.get('summary') or b['code'])[:140]} ({b['code']}) — termen {b['tacit_deadline']}")
    lines += ["", "Lista completă: la-butoane.ro/tacite (link în bio)", "", HASHTAGS]
    if dry:
        print("  would post:", url); return []
    requests.get(url, timeout=90)
    return [(ig.post_image(cfg, url, "\n".join(lines)), "feed", f"tacit: {len(bills)} proiecte", day)]


def do_passed_week(cfg, db, day, dry):
    d = dt.date.fromisoformat(day)
    laws = finished_laws(db, d - dt.timedelta(days=7))
    if not laws:
        return []
    slides = [f"{cfg.site_url}/api/og/weekcover?kind=parlament&n={len(laws)}&v={ig.CARD_V}{day}"] + \
             [f"{cfg.site_url}/api/og/summarycard?id={l['id']}&v={ig.CARD_V}" for l in laws[:9]]
    lines = ["🏛️ Trecute de Parlament săptămâna asta — acum la Președinte sau deja promulgate", ""]
    for l in laws:
        st = {"promulgat": "promulgată", "retrimis": "retrimisă la Parlament", "sesizat_ccr": "contestată la CCR"}.get(l.get("presidential_status") or "", "la Președinte")
        lines.append(f"• {l['code']} — {l.get('headline') or l['title'][:90]} ({st})")
    lines += ["", "Fiecare, explicată pe la-butoane.ro (link în bio)", "", HASHTAGS]
    if dry:
        print("  would carousel:", *slides, sep="\n    "); return []
    for u in slides:
        requests.get(u, timeout=90)
    mid = ig.post_carousel(cfg, slides, "\n".join(lines)) if len(slides) > 1 else ig.post_image(cfg, slides[0], "\n".join(lines))
    return [(mid, "feed", f"trecute de Parlament: {len(laws)} legi", f"{d}")]


def do_absents_week(cfg, db, day, dry):
    if not WEEKLY_ABSENTS_ENABLED:
        print("  weekly absence story disabled until the story-frame deploy is confirmed (AUTOPOST_WEEKLY_ABSENTS=1)")
        return []
    d = dt.date.fromisoformat(day)
    monday = d - dt.timedelta(days=d.isoweekday() - 1)
    url, _caption, warnings = ig._shame_interval(cfg, str(monday), str(d - dt.timedelta(days=1)))
    if warnings:
        print("  skipped — sanity warnings:", *warnings, sep="\n    "); return []
    if dry:
        print("  would story:", url[:120]); return []
    return [(ig.post_story(cfg, url), "story", "absenții săptămânii", str(monday))]


def do_absents_month(cfg, db, day, dry):
    prev = (dt.date.fromisoformat(day).replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
    url = f"{cfg.site_url}/api/og/shamecard?month={prev}&v={day}"
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
    if dry:
        print("  would story:", url); return []
    return [(ig.post_story(cfg, url), "story", f"traseiști {prev}: {len(rows)}", prev)]


HANDLERS = {
    "story-sitting": lambda c, d, day, dry, rows: do_story_sitting(c, d, day, dry),
    "story-switch": lambda c, d, day, dry, rows: do_story_switch(c, d, day, dry),
    "recap-week": lambda c, d, day, dry, rows: do_recap_week(c, d, day, dry),
    "law-finished-1": do_law_finished,
    "backlog": do_law_finished,
    "tacit-countdown": lambda c, d, day, dry, rows: do_tacit(c, d, day, dry),
    "passed-week": lambda c, d, day, dry, rows: do_passed_week(c, d, day, dry),
    "story-absents-week": lambda c, d, day, dry, rows: do_absents_week(c, d, day, dry),
    "absents-month": lambda c, d, day, dry, rows: do_absents_month(c, d, day, dry),
    "switchers-month": lambda c, d, day, dry, rows: do_switchers_month(c, d, day, dry),
    # "explainer", "matrix-quarter": manual — the 09:00 digest reminds
}


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Instagram autopilot")
    ap.add_argument("--date", help="YYYY-MM-DD (default: today, Europe/Bucharest)")
    ap.add_argument("--slot", help="only this slot id")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true", help="ignore the time-of-day gate")
    args = ap.parse_args()

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
        except Exception as e:
            traceback.print_exc()
            notify(f"[LaButoane] ✗ postare eșuată: {s['title']}", f"{day} · {sid}\n{type(e).__name__}: {str(e)[:400]}")
            continue
        for mid, kind, title, key in results:
            if already(rows, day, sid, key):
                continue
            record(day, sid, key, mid, kind, title)
            rows.append({"date": day, "slot": sid, "key": key})
            link = permalink(cfg, mid) if kind == "feed" else "story (24 h) — vezi în app"
            notify(f"[LaButoane] ✓ postat: {title}"[:120], f"{kind} · {s['title']}\n{link}")
            posted += 1
    print(f"done: {posted} post(s)")


if __name__ == "__main__":
    main()
