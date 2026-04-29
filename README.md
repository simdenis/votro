# VotRO — Romanian Parliamentary Vote Tracker

Scrapes Senate plenary vote data from [senat.ro](https://www.senat.ro) and stores it in a Supabase (Postgres) database.

## Project layout

```
.
├── scraper/
│   ├── senat_scraper.py      # Main scraper
│   ├── test_single_vote.py   # Sanity-check a single vote URL
│   └── requirements.txt
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.example
└── README.md
```

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`.
3. Copy your **Project URL** and **service role key** (Settings → API).

---

## 2. Environment variables

```bash
cp .env.example .env
# Edit .env and fill in SUPABASE_URL and SUPABASE_KEY
```

| Variable | Description |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_KEY` | Service role key (not the anon key — needs write access) |
| `SCRAPER_DELAY_MIN` | Min seconds between requests (default `1.0`) |
| `SCRAPER_DELAY_MAX` | Max seconds between requests (default `2.0`) |

---

## 3. Python environment

```bash
cd scraper
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## 4. Sanity check (no Supabase needed)

Fetch and parse one known vote page and print all extracted fields:

```bash
python test_single_vote.py
```

Expected output: law code `L95/2026`, vote date `2026-04-01`, ~97 senators.

---

## 5. Running the scraper

```bash
# Scrape the last 30 days (default)
python senat_scraper.py

# Scrape a specific date range
python senat_scraper.py --start 2026-01-01 --end 2026-04-27

# Scrape a single date
python senat_scraper.py --date 2026-04-01
```

The scraper is **resumable**: it checks `senat_app_id` before inserting and skips already-scraped votes.

Logs are written to `scraper.log` and stdout simultaneously.

---

## 6. Database schema overview

| Table | Key columns | Dedup key |
|---|---|---|
| `laws` | `code`, `title` | `code` |
| `votes` | `law_id`, `vote_date`, `vote_type`, totals | `senat_app_id` |
| `parties` | `name`, `abbreviation` | `abbreviation` |
| `politicians` | `name`, `first_name`, `party_id` | `(name, first_name)` |
| `politician_votes` | `politician_id`, `vote_id`, `vote_choice`, `party_line_deviation` | `(politician_id, vote_id)` |

`party_line_deviation` is `true` when a senator's vote differs from their party's plurality choice on that vote.

Convenience views: `party_vote_summary`, `deviations`.

---

## 7. How enumeration works

senat.ro uses ASP.NET WebForms. The vote index page at `/VoturiPlen.aspx` has a calendar control navigated via `__doPostBack`. Dates are encoded as integer days since **2000-01-01** (confirmed: `V9556` = March 1 2026).

The scraper:
1. GETs the index page to obtain `__VIEWSTATE`.
2. POSTs `V{first_day_of_month}` to navigate to the right month.
3. POSTs `{day_count}` to select a date — response contains the vote list.
4. Extracts `AppID` UUIDs from vote row links.
5. GETs `/VoturiPlenDetaliu.aspx?AppID={uuid}` for each vote.

---

## 8. Politeness & rate limits

- 1–2 second random delay between every request.
- Exponential back-off retry (up to 3 attempts) on HTTP errors.
- Descriptive `User-Agent` header identifying the project.
- Never run with `--start` earlier than 2010 without manual review of the date range.
