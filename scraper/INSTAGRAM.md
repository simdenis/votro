# VotRO → Instagram publishing

Pipeline for posting vote/law cards to the VotRO Instagram account. **Nothing
publishes automatically** — you run `instagram_poster.py` yourself. It is *not*
wired into the daily scrape (`deploy/run_daily.sh`).

## How it works

1. **Image** — `frontend/app/api/og/votecard/route.tsx` renders a 1080×1080 PNG at
   `https://votro.ro/api/og/votecard?vote=<vote_id>`. It's a public URL so the
   Instagram Graph API can fetch it.
2. **Publish** — `instagram_poster.py` builds the caption from Supabase, then:
   creates a media container (`/{ig-user-id}/media`), waits for it to be ready,
   and publishes it (`/{ig-user-id}/media_publish`).

## One-time setup (you must do this — I can't create accounts or tokens)

Uses the **Instagram API with Instagram Login** (host `graph.instagram.com`) —
no Facebook Page needed.

1. Convert the VotRO Instagram account to a **Business or Creator** account.
2. Create a **Meta app** at <https://developers.facebook.com> (type Business)
   and add the *Instagram* product → *API setup with Instagram login*.
3. In the app dashboard, add the VotRO account as an Instagram tester (or use
   *Generate token* directly) and log in with it. Scopes:
   `instagram_business_basic`, `instagram_business_content_publish`.
   This gives you the **account id** (`IG_USER_ID`) and a **short-lived token**.
4. Exchange it for a 60-day token (needs the app secret from the dashboard):

   ```bash
   IG_APP_SECRET=... python instagram_poster.py --exchange-token <short_token>
   ```

Then add to `scraper/.env`:

```
SITE_URL=https://votro.ro
IG_USER_ID=...
IG_ACCESS_TOKEN=...
IG_APP_SECRET=...           # only needed for --exchange-token
# GRAPH_API_VERSION=v21.0   # optional
```

No Meta App Review is needed while posting only to your own account
(Development Mode is enough).

## Usage

```bash
cd scraper
python instagram_poster.py --verify              # confirm the token + account
python instagram_poster.py --vote <id> --dry-run # preview image URL + caption
python instagram_poster.py --vote <id>           # publish it
python instagram_poster.py --image-url <url> --caption "..."   # post anything
python instagram_poster.py --refresh-token       # extend the token 60 days
```

Tokens last 60 days; run `--refresh-token` before expiry (token must be >24h
old) and put the new value in `.env`. Worth a monthly cron once this is stable.

## Law carousels on the Cloudflare Free plan (`--static`)

The seat-arc hemicycle cards (`lawcard`, `tacitcard`, `votecard`, `senatorcard`)
exceed the Free plan's 10ms CPU cap and **503** when Instagram fetches
`/api/og/...`. The light cards (`summarycard`, `deviationcard`, `shamecard`)
render fine and post dynamically. To post a full law carousel, render the heavy
slides **offline** (plain Node, no CPU cap) and serve them as static files:

```bash
# 1. render every slide for the law into frontend/public/ig/
cd frontend
node scripts/render-ig.mjs <law_id>            # spawns `next dev`, or pass --base http://localhost:3000
#    (add --hook "editorial first line" to match the caption)

# 2. deploy so the PNGs are live at https://la-butoane.ro/ig/<name>.png
npm run deploy

# 3. post from the pre-rendered static slides (dry-run first)
cd ../scraper
python instagram_poster.py --law <law_id> --static --dry-run
python instagram_poster.py --law <law_id> --static
```

`render-ig.mjs` asks the poster for the slide manifest (`--emit-slides`), so the
renderer and `--static` posting always agree on the exact slide set and the
deterministic filenames. Bump `CARD_V` after a card redesign — it re-versions
both the dynamic URL and the static filename, so nothing serves a stale image.

## Notes / limits

- Instagram allows **25 published posts per 24h** per account.
- The image URL must be publicly reachable (prod, not localhost) — `--static`
  satisfies this after a deploy; dynamic light cards satisfy it directly.
- The absence post is `--shame` (top-5 absentees, `shamecard`) — it renders on
  Free and posts dynamically today. All-time by default; for a window:

  ```bash
  python instagram_poster.py --shame --luna 2026-06 --dry-run      # a calendar month
  python instagram_poster.py --shame --from 2026-02-01 --to 2026-06-30   # any range
  ```

  Absence in a window = (plenary votes the chamber held in the window − the
  member's participations) ÷ votes held; only members seated the whole window,
  Government excluded. The ranking is computed once in Python (so the card and
  the caption always show the same numbers) and the card is rendered from a
  **signed** payload. Set `CARD_SIGN_SECRET` to the same value in **both**
  `scraper/.env` and the frontend (`wrangler secret put CARD_SIGN_SECRET`) — the
  shamecard route only renders passed data when the signature checks out, so the
  public route can't be used to mint fake branded absence cards. No secret → the
  interval mode is disabled and `--shame` falls back to the all-time card.
- Reels and Stories use a different flow — not implemented yet.
- Caption/design starting points: `_law_slides()` / `build_vote_caption()` and
  the `/api/og/*` routes + `components/cards/*`.
