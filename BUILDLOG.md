# VotRO — Build Log

## Stack decisions

| Layer | Choice | Reason |
|---|---|---|
| Scraper | Python + requests + BeautifulSoup | senat.ro is ASP.NET WebForms with calendar postbacks; no public API |
| Database | Supabase (Postgres) | instant REST/realtime, row-level security, free tier sufficient |
| Frontend | Next.js 15 (App Router) | server components keep DB queries off the client; good SEO |
| Hosting | Vercel | zero-config Next.js deploys |
| Styling | Tailwind CSS | fast iteration, no runtime overhead |

## Schema design

**5 tables:**
- `laws` — code, title, law_category
- `votes` — one row per plenary session vote; links to a law; stores totals + outcome
- `parties` — abbreviation, name, color
- `politicians` — name, chamber, party_id
- `politician_votes` — per-senator vote choice + party_line_deviation flag

**2 views:**
- `law_status` — joins both chambers' most recent vote per law; computes status (complet / asteapta_camera / asteapta_senat / necunoscut)
- `party_vote_breakdown` — aggregates vote choices by party for a given vote session

## Phase structure

**Phase 1 — Scraper**
- ASP.NET calendar navigation via `__doPostBack`
- Parses vote totals, party breakdown, per-senator choices
- Upserts idempotently on `senat_app_id`; can re-scrape safely
- Computes party-line deviations after each vote is stored

**Phase 2 — Frontend**
- `/votes` — paginated vote list with outcome filter
- `/votes/[id]` — vote detail: seat arc, party breakdown donut, senator list
- `/legi` — law tracker showing both chambers; purgatory tab for laws awaiting second chamber
- `/senators` — senator list with loyalty/deviation stats
- `/senators/[id]` — senator profile with vote history
- `/parties` — party cohesion table
- `/parties/[abbr]` — party detail

**Phase 3 — PWA + SEO + performance**
- `manifest.json` + service worker for installability
- Dynamic OG images per vote and per senator (`/api/og/*`)
- `sitemap.ts` + `robots.ts`
- `revalidate` tuning per route (votes: 1h, senators: 1h, live scrape: force-dynamic)

## Key design decisions

- **Minimalist + colorful** — dark surface with high-contrast party color chips; no decorative chrome
- **Party colors** — stored in DB, applied everywhere (badges, charts, seat arc); auto-contrast foreground via WCAG luminance formula
- **Romanian labels throughout** — UI copy, outcomes ("Adoptat"/"Respins"), vote choices ("pentru"/"împotrivă"/"abținere") — no English strings in user-facing UI
- **Journalistic aesthetic** — dense tables over cards; data first, no hero images or marketing copy
- **No auth** — read-only public data; anon Supabase key is sufficient; no user accounts planned

## Known future additions

| Item | Status | Notes |
|---|---|---|
| Camera Deputaților scraper | Done (scraper written) | Data not yet imported into prod |
| Law categories | Pending | Classifier exists in scraper; some laws still uncategorized |
| Senator photos | Deferred to Phase 4 | senat.ro has profile images; scraping and storing adds complexity |
| Native app (iOS/Android) | Deferred | PWA covers mobile for now; native only if analytics justify the investment |
| Law initiators | Skipped | Available on detail page but not relevant enough to scrape |
| Search | Not started | Full-text search on laws/senators via Postgres `tsvector` when needed |
