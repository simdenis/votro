"""Weekly email digest — "Săptămâna în Parlament" for the Resend audience.

Composes a brand-styled HTML email from the same data as the weekly card:
final votes of the week (ranked by interest_score, with the plain-language
summaries), tallies per chamber, tacit terms running, and the week's biggest
party-line break. Sends through Resend Broadcasts, which append the
unsubscribe link automatically.

Manual by design (like instagram_poster.py): --dry-run writes the HTML next
to this script for a look in the browser; --send creates the broadcast and
ships it. A Friday cron can call --send once the format has settled.

Env: RESEND_API_KEY, RESEND_AUDIENCE_ID, SUPABASE_URL, SUPABASE_KEY,
     SITE_URL (defaults to labutoane.vercel.app).
Usage:
    python newsletter.py --dry-run          # writes newsletter-preview.html
    python newsletter.py --send             # actually emails the audience
    python newsletter.py --days 7 --top 5   # window / how many laws
"""
from __future__ import annotations

import argparse
import datetime
import html
import os
import sys

import requests
from dotenv import load_dotenv

INK, PAPER, GRAY = "#171A1F", "#F5F6F8", "#6E7480"
GREEN, RED, AMBER = "#2EA871", "#EE7B5E", "#B27A24"
MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie",
          "august", "septembrie", "octombrie", "noiembrie", "decembrie"]


def ro_date(iso: str) -> str:
    d = datetime.date.fromisoformat(iso[:10])
    return f"{d.day} {MONTHS[d.month - 1]}"


class Data:
    def __init__(self) -> None:
        self.url = os.environ["SUPABASE_URL"].rstrip("/")
        self.h = {"apikey": os.environ["SUPABASE_KEY"],
                  "Authorization": f"Bearer {os.environ['SUPABASE_KEY']}"}

    def get(self, table: str, **params: str) -> list[dict]:
        r = requests.get(f"{self.url}/rest/v1/{table}", params=params, headers=self.h, timeout=30)
        r.raise_for_status()
        return r.json()

    def week(self, days: int, top: int) -> dict:
        cutoff = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
        votes = self.get("votes", select="id,law_id,chamber,vote_date,outcome,for_count,against_count",
                         vote_date=f"gte.{cutoff}")
        finals = [v for v in votes if v.get("law_id")]
        law_ids = sorted({v["law_id"] for v in finals})
        laws: dict[str, dict] = {}
        for i in range(0, len(law_ids), 80):
            for l in self.get("laws", select="id,code,title,summary,law_category,interest_score,presidential_status",
                              id=f"in.({','.join(law_ids[i:i + 80])})"):
                laws[l["id"]] = l
        # one row per law: its most interesting recent vote
        by_law: dict[str, dict] = {}
        for v in finals:
            cur = by_law.get(v["law_id"])
            if not cur or (v["vote_date"] or "") > (cur["vote_date"] or ""):
                by_law[v["law_id"]] = v
        ranked = sorted(
            ({"law": laws[lid], "vote": v} for lid, v in by_law.items() if lid in laws),
            key=lambda x: -(x["law"].get("interest_score") or 0),
        )
        pending = self.get("pending_bills", select="id")

        # Absenții săptămânii: for each chamber's plenary votes this week,
        # active members (ministers excluded — their absence is structural)
        # ranked by missed votes. Absence = chamber votes − participations,
        # same logic as the site's presence stat (senat.ro lists only voters).
        absents: list[dict] = []
        vote_ids_by_chamber: dict[str, list[str]] = {"senate": [], "deputies": []}
        for v in votes:
            if v.get("chamber") in vote_ids_by_chamber:
                vote_ids_by_chamber[v["chamber"]].append(v["id"])
        for chamber, vids in vote_ids_by_chamber.items():
            if not vids:
                continue
            participated: dict[str, int] = {}
            for i in range(0, len(vids), 60):
                for r in self.get("politician_votes", select="politician_id,vote_choice",
                                  vote_id=f"in.({','.join(vids[i:i + 60])})"):
                    if r["vote_choice"] != "absent":
                        participated[r["politician_id"]] = participated.get(r["politician_id"], 0) + 1
            members = self.get("politicians", select="id,name,first_name,gov_role,parties(abbreviation)",
                               chamber=f"eq.{chamber}", active="is.true")
            for m in members:
                if m.get("gov_role"):
                    continue
                missed = len(vids) - participated.get(m["id"], 0)
                if missed > 0:
                    absents.append({
                        "name": f"{m.get('first_name') or ''} {m.get('name') or ''}".strip(),
                        "party": (m.get("parties") or {}).get("abbreviation") or "IND",
                        "chamber": "Senat" if chamber == "senate" else "Cameră",
                        "missed": missed, "total": len(vids),
                    })
        absents.sort(key=lambda a: (-a["missed"] / a["total"], -a["missed"]))

        return {
            "top_absents": absents[:5],
            "votes_total": len(votes),
            "adopted": sum(1 for v in votes if v.get("outcome") == "adoptat"),
            "rejected": sum(1 for v in votes if v.get("outcome") == "respins"),
            "senate": sum(1 for v in votes if v.get("chamber") == "senate"),
            "camera": sum(1 for v in votes if v.get("chamber") == "deputies"),
            "top_laws": ranked[:top],
            "pending_tacit": len(pending),
        }


def render(data: dict, site: str) -> tuple[str, str]:
    today = datetime.date.today()
    subject = f"Săptămâna în Parlament · {today.day} {MONTHS[today.month - 1]}"
    e = html.escape

    def law_block(item: dict) -> str:
        law, vote = item["law"], item["vote"]
        outcome = vote.get("outcome")
        badge = ("ADOPTATĂ", GREEN) if outcome == "adoptat" else ("RESPINSĂ", RED) if outcome == "respins" else ("VOT", GRAY)
        chamber = "Senat" if vote.get("chamber") == "senate" else "Camera Deputaților"
        counts = f"{vote.get('for_count') or 0} pentru · {vote.get('against_count') or 0} împotrivă"
        summary = (law.get("summary") or "").strip()
        return f"""
        <tr><td style="padding:18px 0;border-bottom:1px solid #E7E9EC;">
          <div style="font-family:monospace;font-size:12px;color:{GRAY};margin-bottom:6px;">
            {e(law['code'])}{f" · {e(law['law_category'])}" if law.get('law_category') else ""}
          </div>
          <div style="font-size:16px;font-weight:600;color:{INK};line-height:1.35;margin-bottom:8px;">
            {e((law.get('title') or '')[:180])}
          </div>
          {f'<div style="font-size:14px;color:#3d434c;line-height:1.5;margin-bottom:10px;">{e(summary)}</div>' if summary else ''}
          <div style="font-size:12.5px;color:{GRAY};">
            <span style="background:{badge[1]};color:#fff;font-weight:600;font-size:11px;letter-spacing:1px;padding:3px 10px;border-radius:3px;">{badge[0]}</span>
            &nbsp; {e(chamber)} · {counts} · {ro_date(vote['vote_date'])}
            &nbsp; <a href="{site}/legi/{law['id']}" style="color:{AMBER};">voturile individuale →</a>
          </div>
        </td></tr>"""

    adopted = [i for i in data["top_laws"] if i["vote"].get("outcome") == "adoptat"]
    rejected = [i for i in data["top_laws"] if i["vote"].get("outcome") == "respins"]

    def section(title: str, color: str, items: list) -> str:
        if not items:
            return ""
        head = f'<tr><td style="padding:26px 0 2px;font-size:12px;font-weight:700;letter-spacing:2px;color:{color};">{title}</td></tr>'
        return head + "".join(law_block(i) for i in items)

    laws_html = section("ADOPTATE SĂPTĂMÂNA ASTA", GREEN, adopted) + section("RESPINSE SĂPTĂMÂNA ASTA", RED, rejected)
    if not laws_html:
        laws_html = f'<tr><td style="padding:18px 0;color:{GRAY};font-size:14px;">Săptămână liniștită: niciun vot de plen (vacanță parlamentară).</td></tr>'

    absents_rows = "".join(
        f"""<tr>
          <td style="padding:7px 0;font-size:14px;color:{INK};border-bottom:1px solid #E7E9EC;">
            {html.escape(a['name'])} <span style="color:{GRAY};font-size:12px;">({html.escape(a['party'])} · {a['chamber']})</span>
          </td>
          <td align="right" style="padding:7px 0;font-size:14px;font-weight:700;color:{RED};border-bottom:1px solid #E7E9EC;white-space:nowrap;">
            {a['missed']} din {a['total']} voturi
          </td>
        </tr>"""
        for a in data.get("top_absents", []))
    absents_html = f"""
    <tr><td style="padding:26px 0 6px;font-size:12px;font-weight:700;letter-spacing:2px;color:{RED};">ABSENȚII SĂPTĂMÂNII</td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{absents_rows}</table>
      <div style="font-size:11px;color:{GRAY};padding-top:8px;">Absențe la voturile de plen din această săptămână. Membrii Guvernului nu sunt incluși.</div>
    </td></tr>""" if absents_rows else ""

    body = f"""<!doctype html><html lang="ro"><body style="margin:0;padding:0;background:{PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:32px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td style="padding-bottom:6px;">
    <span style="font-size:22px;color:{INK};">La<strong>Butoane</strong></span>
    <span style="float:right;font-family:monospace;font-size:11px;letter-spacing:2px;color:{GRAY};padding-top:8px;">SĂPTĂMÂNA ÎN PARLAMENT</span>
  </td></tr>
  <tr><td style="border-bottom:2px solid {INK};padding-bottom:10px;">
    <span style="font-size:13px;color:{GRAY};">{today.day} {MONTHS[today.month - 1]} {today.year}</span>
  </td></tr>
  <tr><td style="padding:22px 0 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;color:{GRAY};">Voturi de plen<br><span style="font-size:26px;font-weight:700;color:{INK};">{data['votes_total']}</span></td>
      <td style="font-size:13px;color:{GRAY};">Adoptate<br><span style="font-size:26px;font-weight:700;color:{GREEN};">{data['adopted']}</span></td>
      <td style="font-size:13px;color:{GRAY};">Respinse<br><span style="font-size:26px;font-weight:700;color:{RED};">{data['rejected']}</span></td>
      <td style="font-size:13px;color:{GRAY};">Termene tacite în curs<br><span style="font-size:26px;font-weight:700;color:{AMBER};">{data['pending_tacit']}</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-top:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{laws_html}</table>
  </td></tr>
  {absents_html}
  <tr><td style="padding-top:24px;font-size:13px;color:{GRAY};line-height:1.5;">
    Fiecare vot, fiecare absență, fiecare deviere de la linia de partid:
    <a href="{site}" style="color:{INK};font-weight:600;">labutoane.vercel.app</a>
    &nbsp;·&nbsp; Instagram: <a href="https://instagram.com/la.butoane" style="color:{INK};">@la.butoane</a>
  </td></tr>
  <tr><td style="padding-top:18px;border-top:1px solid #E7E9EC;margin-top:18px;font-size:11px;color:{GRAY};">
    Primești acest email pentru că te-ai abonat pe site. <a href="{{{{{{RESEND_UNSUBSCRIBE_URL}}}}}}" style="color:{GRAY};">Dezabonare</a> ·
    surse: senat.ro / cdep.ro
  </td></tr>
</table>
</td></tr></table></body></html>"""
    return subject, body


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Weekly LaButoane email digest")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--send", action="store_true")
    args = ap.parse_args()
    if not (args.dry_run or args.send):
        sys.exit("pass --dry-run (preview) or --send")

    data = Data().week(args.days, args.top)
    site = os.environ.get("SITE_URL", "https://labutoane.vercel.app").rstrip("/")
    subject, body = render(data, site)

    if args.dry_run:
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "newsletter-preview.html")
        with open(out, "w") as f:
            f.write(body)
        print(f"subject: {subject}")
        print(f"preview: {out}")
        return

    key, audience = os.environ.get("RESEND_API_KEY"), os.environ.get("RESEND_AUDIENCE_ID")
    if not key or not audience:
        sys.exit("RESEND_API_KEY and RESEND_AUDIENCE_ID must be set")
    sender = os.environ.get("NEWSLETTER_FROM", "LaButoane <newsletter@resend.dev>")
    r = requests.post("https://api.resend.com/broadcasts",
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      json={"audience_id": audience, "from": sender, "subject": subject, "html": body},
                      timeout=30)
    if not r.ok:
        sys.exit(f"broadcast create failed ({r.status_code}): {r.text[:300]}")
    bid = r.json()["id"]
    r = requests.post(f"https://api.resend.com/broadcasts/{bid}/send",
                      headers={"Authorization": f"Bearer {key}"}, timeout=30)
    if not r.ok:
        sys.exit(f"broadcast send failed ({r.status_code}): {r.text[:300]}")
    print(f"Sent. broadcast_id={bid}")


if __name__ == "__main__":
    main()
