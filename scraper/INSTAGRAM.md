# VotRO → Instagram publishing

Pipeline for posting vote/law cards to the VotRO Instagram account. **Nothing
publishes automatically** — you run `instagram_poster.py` yourself. It is *not*
wired into the daily scrape (`deploy/run_daily.sh`).

## How it works

1. **Image** — `frontend/app/api/og/post/route.tsx` renders a 1080×1080 PNG at
   `https://votro.ro/api/og/post?vote=<vote_id>`. It's a public URL so the
   Instagram Graph API can fetch it.
2. **Publish** — `instagram_poster.py` builds the caption from Supabase, then:
   creates a media container (`/{ig-user-id}/media`), waits for it to be ready,
   and publishes it (`/{ig-user-id}/media_publish`).

## One-time setup (you must do this — I can't create accounts or tokens)

1. Convert the VotRO Instagram account to a **Business or Creator** account.
2. Connect it to a **Facebook Page** (Instagram requires this for publishing).
3. Create a **Meta app** at <https://developers.facebook.com> and add the
   *Instagram Graph API* product.
4. Generate a **long-lived access token** with scopes:
   `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
   (and `pages_show_list`). Long-lived user tokens last ~60 days; refresh before
   expiry, or use a System User token for a non-expiring one.
5. Find your **Instagram Business account id** (`IG_USER_ID`) via
   `GET /me/accounts` → page → `GET /{page-id}?fields=instagram_business_account`.

Then add to `scraper/.env`:

```
SITE_URL=https://votro.ro
IG_USER_ID=...
IG_ACCESS_TOKEN=...
# GRAPH_API_VERSION=v21.0   # optional
```

## Usage

```bash
cd scraper
python instagram_poster.py --verify              # confirm the token + account
python instagram_poster.py --vote <id> --dry-run # preview image URL + caption
python instagram_poster.py --vote <id>           # publish it
python instagram_poster.py --image-url <url> --caption "..."   # post anything
```

## Notes / limits

- Instagram allows **25 published posts per 24h** per account.
- The image URL must be publicly reachable (Vercel prod, not localhost).
- Carousels, Reels, and Stories use a different flow — not implemented yet.
- The caption hashtags and image design are a starting point; tune in
  `build_vote_caption()` and the `/api/og/post` route.
