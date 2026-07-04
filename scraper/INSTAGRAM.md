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

## Notes / limits

- Instagram allows **25 published posts per 24h** per account.
- The image URL must be publicly reachable (Vercel prod, not localhost).
- Carousels, Reels, and Stories use a different flow — not implemented yet.
- The caption hashtags and image design are a starting point; tune in
  `build_vote_caption()` and the `/api/og/votecard` route + `components/cards/vote-card.tsx`.
