"""Send email alerts to people following a law or an MP (migration 040).

Runs after the daily scrape. For each CONFIRMED subscription:
  - law:        a new plenary vote or promulgation since we last notified → email
  - politician: the MP participated in new votes since last notify → digest email
The subscription's created_at is the baseline until the first notification, so we
never blast someone with activity from before they subscribed. last_notified_at
is stamped after each send so the same event isn't re-sent.

Env: SUPABASE_URL, SUPABASE_KEY (service role), RESEND_API_KEY, NEWSLETTER_FROM,
SITE_URL. Skips silently if RESEND_API_KEY is unset (like the newsletter).
"""
from __future__ import annotations

import datetime
import logging
import os
import sys

import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("alerts")

_TIMEOUT = 30
STATUS_RO = {"promulgat": "promulgată", "retrimis": "retrimisă în Parlament", "sesizat_ccr": "trimisă la CCR"}


class Store:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(self, path: str) -> list[dict]:
        r = requests.get(f"{self.url}/rest/v1/{path}", headers=self.h, timeout=_TIMEOUT)
        r.raise_for_status()
        return r.json()

    def stamp(self, sub_id: str) -> None:
        requests.patch(
            f"{self.url}/rest/v1/alert_subscriptions", params={"id": f"eq.{sub_id}"},
            headers={**self.h, "Content-Type": "application/json"},
            json={"last_notified_at": datetime.datetime.now(datetime.timezone.utc).isoformat()},
            timeout=_TIMEOUT,
        )


def send_email(key: str, sender: str, to: str, subject: str, html: str) -> bool:
    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"from": sender, "to": [to], "subject": subject, "html": html}, timeout=_TIMEOUT,
    )
    if not r.ok:
        log.warning("send failed (%s): %s", r.status_code, r.text[:150])
    return r.ok


def _wrap(site: str, token: str, inner: str) -> str:
    unsub = f"{site}/api/alerts/unsubscribe?token={token}"
    return (f'<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#171A1F;">{inner}'
            f'<p style="color:#9aa0aa;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:14px;">'
            f'Primești asta pentru că urmărești pe LaButoane. <a href="{unsub}" style="color:#9aa0aa;">Dezabonare</a>.</p></div>')


def law_alert(db: Store, key: str, sender: str, site: str, sub: dict) -> None:
    rows = db.get(f"law_status?law_id=eq.{sub['target_id']}&select=*&limit=1")
    if not rows:
        return
    law = rows[0]
    baseline = (sub["last_notified_at"] or sub["created_at"])[:10]
    events = [d for d in (law.get("senate_vote_date"), law.get("camera_vote_date"), law.get("presidential_date")) if d]
    latest = max(events) if events else None
    if not latest or latest <= baseline:
        return
    status = STATUS_RO.get(law.get("presidential_status") or "")
    what = f"a fost {status}" if status else "are un vot nou în plen"
    inner = (f'<h2 style="margin:24px 0 6px;">📋 {law["code"]} {what}</h2>'
             f'<p style="color:#6E7480;margin:0 0 16px;">{(law.get("title") or "").strip()[:160]}</p>'
             + (f'<p style="font-size:15px;line-height:1.5;">{law["summary"].strip()}</p>' if law.get("summary") else "")
             + f'<p style="margin-top:18px;"><a href="{site}/legi/{law["law_id"]}" style="display:inline-block;background:#171A1F;color:#fff;text-decoration:none;border-radius:8px;padding:11px 20px;font-weight:600;">Vezi legea și voturile</a></p>')
    if send_email(key, sender, sub["email"], f"{law['code']}: noutăți", _wrap(site, sub["token"], inner)):
        db.stamp(sub["id"])


def politician_alert(db: Store, key: str, sender: str, site: str, sub: dict) -> None:
    pol = db.get(f"politicians?id=eq.{sub['target_id']}&select=first_name,name,chamber&limit=1")
    if not pol:
        return
    p = pol[0]
    baseline = (sub["last_notified_at"] or sub["created_at"])[:10]
    # votes the MP took part in, after the baseline (final votes only — skip noise)
    rows = db.get(
        f"politician_votes?select=vote_choice,votes!inner(vote_date,chamber,outcome,laws(code,title))"
        f"&politician_id=eq.{sub['target_id']}&votes.vote_type=eq.vot%20final&votes.vote_date=gt.{baseline}"
        f"&order=votes(vote_date).desc&limit=25")
    if not rows:
        return
    CH = {"for": "pentru", "against": "împotrivă", "abstention": "abținere", "not_voted": "nu a votat", "absent": "absent"}
    items = []
    for r in rows:
        v = r.get("votes") or {}
        law = v.get("laws") or {}
        code = law.get("code") or "vot"
        items.append(f'<li style="margin:6px 0;"><strong>{code}</strong> — {CH.get(r["vote_choice"], r["vote_choice"])} '
                     f'<span style="color:#9aa0aa;">({v.get("vote_date","")})</span></li>')
    name = f"{p['first_name']} {p['name']}"
    inner = (f'<h2 style="margin:24px 0 6px;">🗳️ {name} — {len(items)} voturi noi</h2>'
             f'<ul style="padding-left:18px;font-size:14px;">{"".join(items)}</ul>'
             f'<p style="margin-top:14px;"><a href="{site}/{"senatori" if p["chamber"]=="senate" else "deputati"}/'
             f'{sub["target_id"]}" style="color:#4E86D8;">Vezi fișa completă →</a></p>')
    if send_email(key, sender, sub["email"], f"{name}: {len(items)} voturi noi", _wrap(site, sub["token"], inner)):
        db.stamp(sub["id"])


def main() -> None:
    load_dotenv()
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        log.info("RESEND_API_KEY not set — skipping alerts")
        return
    url, sk = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")
    if not (url and sk):
        sys.exit("SUPABASE_URL and SUPABASE_KEY must be set")
    site = os.environ.get("SITE_URL", "https://la-butoane.ro").rstrip("/")
    sender = os.environ.get("NEWSLETTER_FROM", "LaButoane <alerte@la-butoane.ro>")
    db = Store(url, sk)

    subs = db.get("alert_subscriptions?confirmed=eq.true&select=id,email,target_type,target_id,token,created_at,last_notified_at&limit=5000")
    log.info("%d confirmed subscriptions", len(subs))
    sent = 0
    for sub in subs:
        try:
            before = sub.get("last_notified_at")
            (law_alert if sub["target_type"] == "law" else politician_alert)(db, key, sender, site, sub)
            # crude sent counter: stamp changes only on send
        except Exception as e:  # noqa: BLE001
            log.warning("sub %s failed: %s", sub["id"], e)
    log.info("alerts pass done")


if __name__ == "__main__":
    main()
