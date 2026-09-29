"""The Instagram posting calendar — what is due today, and the 09:00 digest.

Single source of truth: frontend/public/posting-schedule.json (the /admin
calendar reads the same file). Nothing here publishes anything: the digest is
an email with the slots due today, the strongest candidates for each, the
admin deep-link, and (Mondays) last week's post metrics. A human presses
publish, as everywhere else in this pipeline.

Usage:
    python post_schedule.py --print [YYYY-MM-DD]       # slots due that day + candidates
    python post_schedule.py --week  [YYYY-MM-DD]       # the whole week
    python post_schedule.py --email [YYYY-MM-DD]       # send the digest to $IG_PREVIEW_EMAIL
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import hmac
import html
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv

from paging import rest_all

SCHEDULE_PATH = Path(__file__).resolve().parent.parent / "frontend" / "public" / "posting-schedule.json"
WEEKDAYS_RO = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"]


# ── schedule ────────────────────────────────────────────────────────────────
def load_schedule() -> dict:
    return json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))


def in_session(day: dt.date, schedule: dict) -> bool:
    md = day.strftime("%m-%d")
    return any(s["from"] <= md <= s["to"] for s in schedule["sessions"])


def due(day: dt.date, schedule: dict | None = None) -> list[dict]:
    """Slots scheduled for `day`, recess rules applied. Event-driven slots
    (party switches) are listed on their weekdays as reminders to check."""
    schedule = schedule or load_schedule()
    session = in_session(day, schedule)
    out = []
    for s in schedule["slots"]:
        if not _matches(s, day) or s.get("event"):
            continue  # event slots (party switches) are added by build() when the event happened
        mode = s.get("in_recess", "keep")
        # "skip" / "replace:<id>": not in recess (the <id> slot carries in_recess "only" and shows itself)
        if not session and (mode == "skip" or mode.startswith("replace:")):
            continue
        if session and mode == "only":
            continue
        out.append(s)
    return out


def _matches(s: dict, day: dt.date) -> bool:
    if "months" in s and day.month not in s["months"]:
        return False
    if "day_of_month" in s:
        return day.day == s["day_of_month"]
    wd = s.get("weekday")
    if wd is None:
        return False
    return day.isoweekday() in (wd if isinstance(wd, list) else [wd])


# ── candidates (what to put in each slot) ───────────────────────────────────
class DB:
    def __init__(self) -> None:
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_KEY", "")
        if not self.url or not key:
            sys.exit("SUPABASE_URL and SUPABASE_KEY must be set")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(self, table: str, **params: str) -> list[dict]:
        r = requests.get(f"{self.url}/rest/v1/{table}", params=params, headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()


def finished_laws(db: DB, since: dt.date) -> list[dict]:
    """Laws that ended their parliamentary road since `since`: adopted by the
    decisional chamber (initiatives.stage adoptat_final) or got a presidential
    decision. Ranked by interest score."""
    rows = db.get("initiatives", select="law_id,senat_code,cdep_code,stage,stage_date",
                  stage="eq.adoptat_final", stage_date=f"gte.{since}", law_id="not.is.null",
                  order="stage_date.desc", limit="60")
    pres = db.get("laws", select="id,code,headline,interest_score,presidential_status,presidential_date",
                  presidential_date=f"gte.{since}", order="presidential_date.desc", limit="60")
    ids = {r["law_id"] for r in rows} | {p["id"] for p in pres}
    if not ids:
        return []
    laws = []
    idl = sorted(ids)
    for i in range(0, len(idl), 80):
        laws += db.get("laws", select="id,code,headline,title,interest_score,presidential_status,presidential_date",
                       id=f"in.({','.join(idl[i:i + 80])})")
    laws.sort(key=lambda l: -(l["interest_score"] or 0))
    return laws


def contested_votes(db: DB, since: dt.date) -> list[dict]:
    """Final votes since `since` with the most party-line deviations — the raw
    material for the Thursday explainer / «cine a rupt rândurile» slot."""
    votes = db.get("votes", select="id,vote_date,chamber,for_count,against_count,abstention_count,present_count,outcome,laws(code,headline,interest_score)",
                   vote_date=f"gte.{since}", vote_type="eq.vot final", law_id="not.is.null", limit="400")
    if not votes:
        return []
    by_id = {v["id"]: v for v in votes}
    devs: dict[str, int] = {}
    ids = list(by_id)
    for i in range(0, len(ids), 60):
        for r in rest_all(db.get, "politician_votes", select="vote_id",
                          vote_id=f"in.({','.join(ids[i:i + 60])})", party_line_deviation="is.true"):
            devs[r["vote_id"]] = devs.get(r["vote_id"], 0) + 1
    for v in votes:
        v["deviations"] = devs.get(v["id"], 0)
        tot = (v["for_count"] or 0) + (v["against_count"] or 0) + (v["abstention_count"] or 0)
        v["margin"] = abs((v["for_count"] or 0) - (v["against_count"] or 0) - (v["abstention_count"] or 0)) / tot if tot else 1
    votes.sort(key=lambda v: (-v["deviations"], v["margin"]))
    return votes[:5]


def tacit_soon(db: DB, day: dt.date, min_score: int) -> list[dict]:
    return db.get("pending_bills", select="code,tacit_deadline,interest_score,summary",
                  **{"and": f"(tacit_deadline.gte.{day},tacit_deadline.lte.{day + dt.timedelta(days=7)})"},
                  interest_score=f"gte.{min_score}", order="tacit_deadline")


def prev_week_final_votes(db: DB, day: dt.date) -> tuple[dt.date, dt.date, int, int]:
    """(monday, sunday, adopted, rejected) of the previous calendar week."""
    monday = day - dt.timedelta(days=day.isoweekday() - 1 + 7)
    sunday = monday + dt.timedelta(days=6)
    votes = db.get("votes", select="outcome,vote_date", vote_type="eq.vot final", law_id="not.is.null",
                   vote_date=f"gte.{monday}", limit="1000")
    inweek = [v for v in votes if v["vote_date"] <= str(sunday)]
    return monday, sunday, sum(v["outcome"] == "adoptat" for v in inweek), sum(v["outcome"] == "respins" for v in inweek)


def ig_last_week(day: dt.date) -> list[dict]:
    """Reach / saves / follows for posts published in the last 7 days."""
    uid, tok = os.environ.get("IG_USER_ID"), os.environ.get("IG_ACCESS_TOKEN")
    if not (uid and tok):
        return []
    since = (day - dt.timedelta(days=7)).isoformat()
    try:
        r = requests.get(f"https://graph.instagram.com/v21.0/{uid}/media",
                         params={"fields": "id,timestamp,caption,permalink,like_count", "limit": 15, "access_token": tok}, timeout=30)
        out = []
        for m in r.json().get("data", []):
            if m["timestamp"][:10] < since:
                continue
            ins = requests.get(f"https://graph.instagram.com/v21.0/{m['id']}/insights",
                               params={"metric": "reach,saved,shares,follows", "access_token": tok}, timeout=30).json()
            d = {x["name"]: x["values"][0]["value"] for x in ins.get("data", [])}
            out.append({"date": m["timestamp"][:10], "caption": (m.get("caption") or "")[:70].replace("\n", " "),
                        "likes": m.get("like_count", 0), "url": m["permalink"], **d})
        return out
    except Exception:
        return []


# ── rendering ───────────────────────────────────────────────────────────────
def _admin_href(site: str, anchor: str) -> str:
    """Login-token deep link into /admin#anchor (same scheme as the approval
    email: HMAC of the expiry under ADMIN_KEY, valid 30 min). Falls back to the
    plain URL when ADMIN_KEY is unset (cookie may already be there)."""
    key = os.environ.get("ADMIN_KEY", "")
    if not key:
        return f"{site}/admin#{anchor}"
    exp = int(time.time()) + 1800
    sig = hmac.new(key.encode(), f"login-v1:{exp}".encode(), hashlib.sha256).hexdigest()
    return f"{site}/api/admin/login?t={quote(f'{exp}.{sig}')}&next={quote(f'/admin#{anchor}', safe='')}"


def build(day: dt.date) -> dict:
    """Everything the digest / --print needs, computed once."""
    schedule = load_schedule()
    db = DB()
    site = os.environ.get("SITE_URL", "https://la-butoane.ro").rstrip("/")
    slots = due(day, schedule)
    # event slots: a party switch registered today → the story reminder
    switches = db.get("politician_party_history", select="politician_id,from_date,politicians(name,first_name,chamber),parties(abbreviation)",
                      from_date=f"eq.{day}", limit="20")
    if switches:
        for s in schedule["slots"]:
            if s.get("event") == "switch" and s["id"] not in {x["id"] for x in slots}:
                slots.insert(0, s)
    week_ago = day - dt.timedelta(days=7)
    ctx: dict = {"day": day, "session": in_session(day, schedule), "slots": [], "site": site}
    for s in slots:
        item = {"slot": s, "admin": _admin_href(site, s["section"]), "lines": []}
        sid = s["id"]
        if sid == "recap-week":
            mon, sun, ad, rj = prev_week_final_votes(db, day)
            item["lines"].append(f"Săptămâna {mon:%d.%m}–{sun:%d.%m}: {ad} voturi finale adoptate, {rj} respinse.")
            item["card"] = f"{site}/api/og/weekcover?kind=votate"
        elif sid in ("law-finished-1", "passed-week", "backlog"):
            for l in finished_laws(db, week_ago if sid != "backlog" else day - dt.timedelta(days=365))[:5]:
                st = l["presidential_status"] or "adoptată de Parlament"
                item["lines"].append(f"{l['code']} · {st} · interes {l['interest_score'] or '–'} — {l['headline'] or l['title'][:90]}")
            if sid == "passed-week":
                item["card"] = f"{site}/api/og/weekcover?kind=parlament"
        elif sid == "tacit-countdown":
            bills = tacit_soon(db, day, s.get("min_score", 60))
            if not bills:
                item["lines"].append(f"Nimic cu scor ≥ {s.get('min_score', 60)} în următoarele 7 zile — sari peste slot.")
                item["skip"] = True
            for b in bills:
                item["lines"].append(f"{b['code']} · expiră {b['tacit_deadline']} · interes {b['interest_score']} — {(b['summary'] or '')[:90]}")
            item["card"] = f"{site}/api/og/tacitlist?d={day}"
        elif sid == "explainer":
            for v in contested_votes(db, week_ago):
                l = v.get("laws") or {}
                item["lines"].append(f"{l.get('code')} · {v['chamber']} {v['vote_date']} · {v['for_count']}/{v['against_count']}/{v['abstention_count']} {v['outcome']} · {v['deviations']} devieri — {(l.get('headline') or '')[:80]}")
            if not item["lines"]:
                item["lines"].append("Niciun vot final cu devieri săptămâna asta — folosește un explainer «cum funcționează».")
        elif sid == "story-switch":
            for x in switches:
                pol = x.get("politicians") or {}
                item["lines"].append(f"{pol.get('first_name', '')} {pol.get('name', '')} ({'Senat' if pol.get('chamber') == 'senate' else 'Cameră'}) → {(x.get('parties') or {}).get('abbreviation', '?')}")
        elif sid == "story-absents-week":
            item["lines"].append("Datele vin din newsletter (sâmbătă); publică doar dacă fiecare cameră a avut ≥ 30 de voturi.")
        elif sid == "absents-month":
            item["lines"].append("Cardul semnat + alertele sunt în emailul de aprobare de azi dimineață.")
        elif sid == "switchers-month":
            m = (day.replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
            item["card"] = f"{site}/api/og/switchcard?month={m}"
        ctx["slots"].append(item)
    if day.isoweekday() == 1:
        ctx["ig"] = ig_last_week(day)
    return ctx


def print_day(ctx: dict) -> None:
    d = ctx["day"]
    print(f"{WEEKDAYS_RO[d.isoweekday() - 1]} {d:%d.%m.%Y} · {'sesiune' if ctx['session'] else 'VACANȚĂ parlamentară'}")
    if not ctx["slots"]:
        print("  (nimic programat)")
    for it in ctx["slots"]:
        s = it["slot"]
        print(f"\n  [{s['format']:5}] {s['time']:>12}  {s['title']}{'  — SKIP' if it.get('skip') else ''}")
        for ln in it["lines"]:
            print(f"           · {ln}")
        if it.get("card"):
            print(f"           card: {it['card']}")
    for p in ctx.get("ig", []):
        print(f"  IG {p['date']} reach {p.get('reach', '?')} save {p.get('saved', '?')} share {p.get('shares', '?')} follow {p.get('follows', '?')} — {p['caption']}")


def email_html(ctx: dict) -> str:
    d = ctx["day"]
    e = html.escape
    parts = [f'<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:620px;margin:0 auto;color:#171A1F;">',
             f'<h2 style="margin:24px 0 4px;">Azi pe IG — {WEEKDAYS_RO[d.isoweekday() - 1]} {d:%d.%m}</h2>',
             f'<p style="color:#6E7480;margin:0 0 20px;">{"Sesiune parlamentară." if ctx["session"] else "Vacanță parlamentară — grila redusă."} Nimic nu se publică singur.</p>']
    if not ctx["slots"]:
        parts.append('<p>Nimic programat azi.</p>')
    for it in ctx["slots"]:
        s = it["slot"]
        tag = "STORY" if s["format"] == "story" else "FEED"
        col = "#B27A24" if s["format"] == "story" else "#1F7A51"
        parts.append(f'<div style="border:1px solid #E7E9EC;border-radius:10px;padding:14px 16px;margin:0 0 14px;{"opacity:.55;" if it.get("skip") else ""}">'
                     f'<div style="font-family:monospace;font-size:12px;letter-spacing:1px;color:{col};">{tag} · {e(s["time"])}</div>'
                     f'<div style="font-weight:700;margin:4px 0 6px;">{e(s["title"])}</div>'
                     f'<div style="font-size:13px;color:#6E7480;margin:0 0 8px;">{e(s.get("why", ""))}</div>')
        if it["lines"]:
            parts.append('<ul style="margin:0 0 10px;padding-left:18px;font-size:13px;line-height:1.5;">'
                         + "".join(f"<li>{e(ln)}</li>" for ln in it["lines"]) + "</ul>")
        if it.get("card"):
            parts.append(f'<div style="font-size:12px;margin:0 0 8px;"><a href="{e(it["card"], quote=True)}">preview card</a></div>')
        parts.append(f'<a href="{e(it["admin"], quote=True)}" style="display:inline-block;background:#171A1F;color:#fff;text-decoration:none;'
                     f'border-radius:8px;padding:8px 14px;font-weight:600;font-size:13px;">Deschide în admin</a></div>')
    if ctx.get("ig"):
        parts.append('<h3 style="margin:24px 0 8px;">Săptămâna trecută pe IG</h3><table style="font-size:12.5px;border-collapse:collapse;">'
                     '<tr><th align="left">data</th><th align="right">reach</th><th align="right">salvări</th><th align="right">distrib.</th><th align="right">urmăritori</th><th align="left">post</th></tr>')
        for p in ctx["ig"]:
            parts.append(f'<tr><td>{p["date"][5:]}</td><td align="right">{p.get("reach", "–")}</td><td align="right">{p.get("saved", "–")}</td>'
                         f'<td align="right">{p.get("shares", "–")}</td><td align="right">{p.get("follows", "–")}</td>'
                         f'<td><a href="{e(p["url"], quote=True)}">{e(p["caption"][:50])}</a></td></tr>')
        parts.append("</table>")
    parts.append('<p style="color:#9AA0AA;font-size:12px;margin-top:24px;">Grila: frontend/public/posting-schedule.json · docs/POSTING_SCHEDULE.md</p></div>')
    return "".join(parts)


def send_email(ctx: dict, to_addr: str) -> None:
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        sys.exit("RESEND_API_KEY must be set")
    sender = os.environ.get("NEWSLETTER_FROM", "LaButoane <newsletter@resend.dev>")
    d = ctx["day"]
    n = len([s for s in ctx["slots"] if not s.get("skip")])
    r = requests.post("https://api.resend.com/emails",
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      json={"from": sender, "to": [to_addr],
                            "subject": f"[LaButoane] Azi pe IG — {WEEKDAYS_RO[d.isoweekday() - 1]} {d:%d.%m}: {n} postăr{'i' if n != 1 else 'e'}",
                            "html": email_html(ctx)}, timeout=30)
    if not r.ok:
        sys.exit(f"digest email failed ({r.status_code}): {r.text[:300]}")
    print(f"Digest sent to {to_addr}. id={r.json().get('id')}")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Instagram posting calendar")
    ap.add_argument("--print", dest="do_print", action="store_true")
    ap.add_argument("--week", action="store_true", help="print the whole week (no candidates)")
    ap.add_argument("--email", action="store_true", help="send the digest to $IG_PREVIEW_EMAIL")
    ap.add_argument("date", nargs="?", help="YYYY-MM-DD (default: today, Europe/Bucharest)")
    args = ap.parse_args()
    if args.date:
        day = dt.date.fromisoformat(args.date)
    else:
        try:
            from zoneinfo import ZoneInfo
            day = dt.datetime.now(ZoneInfo("Europe/Bucharest")).date()
        except Exception:
            day = dt.date.today()

    if args.week:
        sched = load_schedule()
        monday = day - dt.timedelta(days=day.isoweekday() - 1)
        for i in range(7):
            d = monday + dt.timedelta(days=i)
            items = due(d, sched)
            print(f"{WEEKDAYS_RO[i]:<9} {d:%d.%m}  " + (" | ".join(f"{s['format']}: {s['title']}" for s in items) or "—"))
        return
    ctx = build(day)
    if args.email:
        to = os.environ.get("IG_PREVIEW_EMAIL", "")
        if not to:
            sys.exit("IG_PREVIEW_EMAIL must be set")
        send_email(ctx, to)
    else:
        print_day(ctx)


if __name__ == "__main__":
    main()
