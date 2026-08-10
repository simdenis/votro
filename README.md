# VotRO — Romanian Parliamentary Vote Tracker

Tracks how every member of the Romanian Parliament votes, in plain language, and
makes it searchable, shareable, and downloadable as open data.

**Live:** [la-butoane.ro](https://la-butoane.ro) · weekly newsletter · Instagram cards

It ingests **nominal plenary votes from both chambers** — the Senate
([senat.ro](https://www.senat.ro)) and the Chamber of Deputies
([cdep.ro](https://www.cdep.ro)) — for the current legislature (since December
2024), links each vote to its bill, follows the bill through to promulgation, and
surfaces the things official sources make hard to see: how each MP voted,
party-line deviations, attendance, party switching, and bills that pass *without a
vote*.

---

## What it surfaces

- **Roll-call record** — how each MP voted on every plenary vote, with the
  party-line deviation flagged.
- **Attendance** — presence/absence per MP, with fairness guards on the public
  rankings (not just a raw "most absent" list).
- **Party switching (traseism)** — reconstructed from the official membership
  lists, so a one-sitting mislabel doesn't read as a switch.
- **Tacit adoption (art. 75)** — bills that become law because a chamber let the
  constitutional term lapse without voting. Tracked with a live countdown.
- **A bill's full journey** — chamber outcomes → CCR (constitutional court) →
  presidential promulgation.
- **Plain-language summaries** — the official gist of a bill, with the source PDF
  always one click away.

**Scope & limits (also on [/despre](https://la-butoane.ro/despre)):** nominal
plenary votes only — not committee votes, not secret electronic ballots. Data is
as complete and fresh as the official sources publish it (daily, ~24h lag
possible). An internal AI "interest" score helps decide what to feature in the
newsletter/Instagram; it is **not shown on the site and does not order or affect
any public data**.

---

## Architecture

```
  senat.ro ─┐
  cdep.ro  ─┤   scraper/ (Python, on an EU VPS)          Supabase (Postgres)
  presidency┤   ├─ scrape both chambers + rosters   ─▶   ├─ votes, politician_votes
  gov.ro   ─┘   ├─ resolve PLx⇄L registries              ├─ laws, law_status (view)
                ├─ presidential / CCR / tacit status      ├─ party history, pending_bills
                ├─ plain-language + AI summaries          └─ analytics materialized views
                ├─ refresh matviews, validate                     │
                └─ newsletter · Instagram · alerts                 │ anon read (RLS)
                                                                   ▼
                                        frontend/ (Next.js 15 App Router)
                                        └─ deployed to Cloudflare Workers (OpenNext)
                                           ├─ public site + /api/v1 open data (CSV/JSON)
                                           ├─ share/Instagram cards (satori)
                                           └─ admin behind Cloudflare Access
```

The daily pipeline runs from an EU VPS because **cdep.ro geo-blocks non-EU IPs**.
`deploy/run_daily.sh` orchestrates it under systemd timers (a full twice-daily run
plus a ~40s "votes only" run every 15 min during plenary hours), with a heartbeat
and a post-run integrity check.

---

## Repository layout

```
scraper/            Python data pipeline (~35 modules) — see below
  senat_scraper.py        Senate plenary votes (senat.ro, ASP.NET WebForms)
  camera_scraper.py       Chamber of Deputies plenary votes (cdep.ro)
  roster_scraper.py       Active mandates + electoral county, both chambers
  resolve_plx.py          Map Chamber PLx{n}/{yr} codes to their Senate L codes
  presidential_scraper.py Promulgation + CCR status for each bill
  tacit_scraper.py        Bills with a running art. 75 tacit-adoption term
  initiator_scraper.py    Who proposed each bill
  gov_scraper.py          Cabinet / government roles
  rebuild_party_history.py Clean chronological party segments (traseism)
  categorize_laws.py      Topic category per law
  law_summarizer.py       Extract the official summary (no AI)
  gemini_summarizer.py    Plain-language summaries (Gemini)
  haiku_summarizer.py     Plain-language summaries (Claude Haiku)
  interest_scorer.py      Internal 1–100 "interest" signal (post-selection only)
  refresh_matviews.py     Rebuild analytics materialized views
  newsletter.py           Weekly "Săptămâna în Parlament" digest (Resend)
  instagram_poster.py     Post generated cards to Instagram
  send_alerts.py          Email people following a law or an MP
  validate.py             Post-scrape data-integrity smoke test
  paging.py               PostgREST 1000-row-cap paging helper
  ...                     backfills, name utils, heartbeat, test scripts
frontend/           Next.js 15 app → Cloudflare Workers (OpenNext)
  app/api/v1/             Public open-data API (votes, laws, parlamentari, export)
  lib/, components/       Data access, UI, satori share cards
  test/                   Vitest regression tests
supabase/migrations/ 57 SQL migrations (schema, views, RLS, RPCs)
deploy/             run_daily.sh + systemd unit/timer files (VPS)
```

---

## Data model (core tables)

| Table | What it holds | Dedup key |
|---|---|---|
| `laws` | Bills — code, title, category, summary | `code` |
| `votes` | Plenary votes — chamber, date, totals, outcome | `senat_app_id` / cdep `idv` |
| `politicians` | MPs — name, party, chamber, mandate, county | `(name, first_name)` |
| `parties` | Parties | `abbreviation` |
| `politician_votes` | Roll call — one row per MP per vote | `(politician_id, vote_id)` |
| `politician_party_history` | Party membership over time (traseism) | derived |
| `pending_bills` | Bills under a tacit-adoption term | `code` |

`law_status` (view) stitches a bill's chamber outcomes, CCR decision, and
presidential status into one row. Analytics (party agreement, monthly attendance,
absence rankings) live in materialized views refreshed after each run.

---

## Public API (open data)

Read-only, anon, CORS-open — documented at [/date](https://la-butoane.ro/date):

```
GET /api/v1/votes?format=json|csv
GET /api/v1/laws?code=L230/2025
GET /api/v1/parlamentari
GET /api/v1/export/{voturi|legi|deputati|senatori}[?format=csv]
```

Everything is sourced from senat.ro / cdep.ro and independently verifiable.

---

## Local development

### Scraper

```bash
cd scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env      # fill SUPABASE_URL + SUPABASE_KEY (service role)

python test_single_vote.py      # parse one Senate vote, no DB needed
python test_camera_vote.py      # parse one Chamber vote, no DB needed

python senat_scraper.py  --date 2026-04-01
python camera_scraper.py --date 2026-04-01
```

Both scrapers are **resumable** (they skip votes already stored by their source
id), rate-limited (1–2s jitter, exponential back-off), and identify themselves via
`User-Agent`. Full and fast runs are wired together in `deploy/run_daily.sh`.

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest regression tests
npm run deploy     # OpenNext build + deploy to Cloudflare Workers
```

Frontend env lives in `frontend/.env.local` (Supabase URL + anon key, plus
service keys for Resend, AI providers, and the cron secret in production).

---

## How chamber enumeration works

Both official sites need reverse-engineered navigation:

- **Senate (`senat_scraper.py`)** — ASP.NET WebForms. The vote index is driven by
  a calendar posted back via `__VIEWSTATE`; dates encode as integer days since
  2000-01-01. The scraper posts the month, then the day, reads the vote list, and
  fetches each `VoturiPlenDetaliu.aspx?AppID={uuid}`.
- **Chamber (`camera_scraper.py`)** — a plain daily list at
  `cdep.ro/pls/steno/evot.lista?dat=YYYYMMDD&idl=1`; extract each `idv`, then fetch
  `evot.lista?idv={id}&idl=1` for the per-party deputy breakdown.

The two chambers number bills in separate registries (Senate `L…`, Chamber
`PLx…`); `resolve_plx.py` reconciles them so a bill's whole journey is one record.
