#!/usr/bin/env bash
# VotRO — scrape both chambers. Runs on an EU/RO VPS where cdep.ro is reachable.
# Usage:
#   run_daily.sh            -> scrape yesterday AND today (UTC); upserts are idempotent
#   run_daily.sh YYYY-MM-DD -> scrape a single date
#   run_daily.sh --fast     -> votes only (~40s): both chambers + PLx resolution.
#                              Runs every 15 min during plenary hours so the site
#                              shows a vote minutes after it happens; the heavy
#                              enrichment (25+ min against cdep/senat/presidency,
#                              Gemini) stays on the twice-daily full run.
set -uo pipefail

REPO_DIR="${VOTRO_REPO_DIR:-/opt/votro}"
LOG_DIR="${VOTRO_LOG_DIR:-/var/log/votro}"
PY="$REPO_DIR/scraper/.venv/bin/python"

FAST=0
if [ "${1:-}" = "--fast" ]; then FAST=1; shift; fi

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/scrape-$(date -u '+%Y%m%d').log"
log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG"; }

cd "$REPO_DIR" || { log "FATAL: repo dir $REPO_DIR missing"; exit 1; }

# CRON_SECRET lives in .env (single source of secrets), but this script never
# sources .env — it holds values with spaces and redirection chars that break
# `source`. Pull out just this one key for the cache-warm curl below.
CRON_SECRET="$(sed -n 's/^CRON_SECRET=//p' "$REPO_DIR/.env" 2>/dev/null | head -1)"
export CRON_SECRET

# One run at a time. The fast timer fires every 15 min while a full run can take
# well over an hour; without this they would scrape the same dates concurrently
# and race on the same rows. Taken BEFORE the heartbeat trap is installed, so a
# skipped run leaves scrape_meta alone instead of reporting a result it never got.
exec 9>"$LOG_DIR/.scrape.lock"
if ! flock -n 9; then
  log "=== Skipped ($([ "$FAST" = 1 ] && echo fast || echo full)) — another run holds the lock ==="
  exit 0
fi

# Heartbeat on EVERY exit (trap), not just a clean finish. Otherwise a crash in
# a late step (OOM, a hung API call, the cdep preflight below) freezes
# scrape_meta.last_scrape_at while the data actually updated — and the footer
# shows a false "stale" ⚠. rc || ec so a hard early exit is recorded as rc=1.
rc=0
heartbeat() {
  local ec=$?
  "$PY" "$REPO_DIR/scraper/heartbeat.py" "$(( rc || ec ))" >>"$LOG" 2>&1 || log "WARN: heartbeat write failed"
}
trap heartbeat EXIT

if [ -n "${1:-}" ]; then
  DATES=("$1")
else
  DATES=("$(date -u -d 'yesterday' '+%Y-%m-%d')" "$(date -u '+%Y-%m-%d')")
fi

# Preflight: cdep.ro silently drops packets from non-EU IPs. On the full run this
# is fatal (the enrichment below needs cdep). On a fast run a transient blip
# shouldn't page us — skip the Chamber this cycle and carry on with the Senate.
CDEP_OK=1
if ! nc -z -w 5 www.cdep.ro 443 2>/dev/null; then
  CDEP_OK=0
  if [ "$FAST" = 1 ]; then
    log "WARN: cdep.ro:443 unreachable — skipping Camera + PLx this fast cycle (Senate only)."
  else
    log "FATAL: cdep.ro:443 unreachable — this VPS is not on an EU/RO IP (or cdep is down)."
    rc=1
    exit 1
  fi
fi

# Stay current: scraper fixes land on main and must apply from the next run
# (a stale scraper once re-introduced wrong PL-x→L law links). Non-fatal.
git pull --ff-only >>"$LOG" 2>&1 || log "WARN: git pull failed — running existing code"

for TARGET in "${DATES[@]}"; do
  if [ "$CDEP_OK" = 1 ]; then
    log "=== Camera Deputatilor — $TARGET ==="
    "$PY" scraper/camera_scraper.py --date "$TARGET" >>"$LOG" 2>&1 || { rc=1; log "Camera scrape FAILED ($TARGET)"; }
  fi

  log "=== Senat — $TARGET ==="
  "$PY" scraper/senat_scraper.py --date "$TARGET" >>"$LOG" 2>&1 || { rc=1; log "Senat scrape FAILED ($TARGET)"; }
done

# Merge Camera-registry duplicates (PLx…) into their Senate L laws. Needs
# cdep.ro (project fisa), so it must run here on the EU VPS — the senat.ro
# PLX search the old resolver used returns zero results.
if [ "$CDEP_OK" = 1 ]; then
  log "=== PLx → L resolution ==="
  "$PY" scraper/resolve_plx.py >>"$LOG" 2>&1 || { rc=1; log "PLx resolver FAILED"; }
fi

# Everything above is what a vote actually needs: the two chamber scrapes and the
# law-code merge. The site's vote counts and presence figures read live views
# (deputy_stats / senator_stats), so they are already correct at this point — the
# steps below enrich laws, not votes. Fast mode stops here; the trap writes the
# heartbeat, which is what keeps the footer from going stale between full runs.
if [ "$FAST" = 1 ]; then
  log "=== Done (fast, rc=$rc) ==="
  exit $rc
fi

# Collapse politician_party_history into clean chronological segments. The
# per-vote state machine assumes date-ordered processing (it isn't), so it
# leaves same-party duplicates + inverted intervals; this rebuild is idempotent
# and absorbs them. Must run after both chamber scrapes.
log "=== Party-history rebuild ==="
"$PY" scraper/rebuild_party_history.py >>"$LOG" 2>&1 || { rc=1; log "Party-history rebuild FAILED"; }

# Presidential / CCR status is law-based, not date-based: re-check laws that
# passed both chambers but have no promulgation status yet (senat.ro journey).
log "=== Presidential / CCR status (senat.ro) ==="
"$PY" scraper/presidential_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Presidential scrape FAILED"; }

# Authoritative promulgation source: presidency.ro decrees (senat.ro's fisa
# often omits them). Clears a JS proof-of-work, resolves PL-x → L via cdep.
log "=== Presidential decrees (presidency.ro) ==="
"$PY" scraper/presidential_decree_scraper.py --years "$(date -u '+%Y')" >>"$LOG" 2>&1 || { rc=1; log "Decree scrape FAILED"; }

# Plain-language law summaries via Gemini (reads the expunere de motive PDF
# natively). Incremental (summary_checked_at IS NULL), resumable, 429-safe.
# Skips silently if GEMINI_API_KEY is unset — summaries stay link-only.
log "=== Law summaries (Gemini) ==="
"$PY" scraper/gemini_summarizer.py >>"$LOG" 2>&1 || { rc=1; log "Gemini summarizer FAILED"; }

# AI categories (Claude Haiku) for laws the title-regex classifier missed — reads
# the fresh summary, so it runs after the summarizer and before interest scoring
# (which uses the category). Only fills law_category IS NULL.
#
# Back on Haiku after the Gemini port (83d6cc7) sent the key in a form that
# endpoint rejects: every call answered 401 "Expected OAuth 2 access token", and
# because an unparseable answer is treated as "no category", the step burned
# through the backlog logging NICIUNA instead of failing loudly. Haiku is ~$0.0003
# per law — the whole backlog is under $0.10 — and it has no free-tier quota to
# exhaust, which is what also takes down the two scorers below.
log "=== Law categories (Claude Haiku) ==="
"$PY" scraper/categorize_laws.py >>"$LOG" 2>&1 || { rc=1; log "Categorizer FAILED"; }

# Public-interest scores (1-100) for post selection — runs after the summarizer
# so fresh summaries feed the rating. Incremental, 429-safe, skips without key.
log "=== Interest scores (Gemini) ==="
"$PY" scraper/interest_scorer.py >>"$LOG" 2>&1 || { rc=1; log "Interest scorer FAILED"; }

# Active mandates + electoral county from the official member lists. Never
# mass-deactivates on a broken parse (sanity floors inside).
log "=== Roster (active mandates + county) ==="
"$PY" scraper/roster_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Roster scrape FAILED"; }

# Refresh the party_agreement matrix (materialized view, migration 029) so
# /analize reflects new votes. Cheap no-op during recess; non-fatal.
log "=== Refresh analytics matviews ==="
"$PY" scraper/refresh_matviews.py >>"$LOG" 2>&1 || { rc=1; log "Matview refresh FAILED"; }

# Government roles (gov.ro cabinet page) — labels MPs serving as ministers.
# Runs after the roster so newly inserted members can be labeled. Never wipes
# labels on a broken parse (sanity floor inside).
log "=== Government roles (gov.ro) ==="
"$PY" scraper/gov_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Gov roles scrape FAILED"; }

# Who proposed each law — initiators from the senat.ro fisa. Incremental
# (initiators_checked_at IS NULL), retried, name-matched to politicians.
log "=== Law initiators (senat.ro fisa) ==="
"$PY" scraper/initiator_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Initiator scrape FAILED"; }

# Bills with running tacit-adoption terms (cdep "Verificare termene legale").
log "=== Tacit deadlines ==="
"$PY" scraper/tacit_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Tacit scrape FAILED"; }

# All filed initiatives (cdep PL-x listing + senat L registry) — including the
# ones stuck in committee that never reach a plenary vote (/initiative).
log "=== Initiatives (cdep + senat registries) ==="
"$PY" scraper/initiative_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Initiative scrape FAILED"; }

# AI summary + interest score for pending bills (Gemini reads the expunere
# PDF). Incremental (ai_checked_at IS NULL), skips without key. Ranks the
# weekly "pe cale să treacă tacit" post by hotness instead of deadline alone.
log "=== Pending-bill AI scores (Gemini) ==="
"$PY" scraper/pending_bills_scorer.py >>"$LOG" 2>&1 || { rc=1; log "Pending-bill scorer FAILED"; }

# Data-integrity gate: deterministic invariants over everything produced above
# (no law promulgated-yet-respins, presence in range, participations ≤ chamber
# votes, no inverted party-history intervals, no orphan parties, …). A FAIL
# means we wrote bad data — fold it into rc so the heartbeat flags it.
log "=== Validation ==="
"$PY" scraper/validate.py >>"$LOG" 2>&1 || { rc=1; log "Validation found bad data"; }

# Saturday: the weekly email digest (absents of the week + laws adopted/
# rejected). Needs RESEND_API_KEY / RESEND_AUDIENCE_ID / NEWSLETTER_FROM in
# scraper/.env — skips gracefully when unset. Failure must not flip the
# heartbeat: email trouble is not a data-pipeline problem.
# Once-per-day marker: run_daily fires twice a day (06 and 14 UTC), and a
# weekday guard alone sent the newsletter twice on 2026-08-01. The marker is
# written only after a successful send, so a failed morning send still gets
# the afternoon retry.
if [ "$(date -u +%u)" = "6" ] && [ ! -f "/tmp/.newsletter-sent-$(date -u +%Y%m%d)" ]; then
  log "=== Weekly newsletter (Saturday) ==="
  if "$PY" scraper/newsletter.py --send >>"$LOG" 2>&1; then
    touch "/tmp/.newsletter-sent-$(date -u +%Y%m%d)"
  else
    log "WARN: newsletter send failed"
  fi
fi

# 1st of the month: email last month's IG absence-card preview (image + caption
# + sanity warnings) for manual approval — it NEVER publishes to Instagram.
# Needs IG_PREVIEW_EMAIL, RESEND_API_KEY, CARD_SIGN_SECRET in scraper/.env.
# Like the newsletter, email trouble must not flip the heartbeat.
if [ "$(date -u +%d)" = "01" ] && [ ! -f "/tmp/.igpreview-sent-$(date -u +%Y%m)" ]; then
  log "=== Monthly IG absence preview (approval email) ==="
  if "$PY" scraper/instagram_poster.py --shame --email-preview >>"$LOG" 2>&1; then
    touch "/tmp/.igpreview-sent-$(date -u +%Y%m)"
  else
    log "WARN: IG preview email failed"
  fi
fi

# Mondays: extend the Instagram token. It is long-lived, which means 60 days,
# and nothing renewed it — so it would have expired around late September and
# the monthly absence card would have stopped arriving with no error anyone
# reads (the step below is WARN-only by design). Weekly rather than monthly so a
# few missed runs still leave weeks of margin; the API only requires the token to
# be older than 24h. Writes the new value back into .env itself.
if [ "$(date -u +%u)" = "1" ]; then
  log "=== Instagram token refresh (weekly) ==="
  "$PY" scraper/instagram_poster.py --refresh-token >>"$LOG" 2>&1 || log "WARN: IG token refresh failed"
fi

# Email alerts for followed laws/MPs (migration 040). New vote/promulgation →
# email the confirmed followers. Skips without RESEND_API_KEY. Email trouble
# must not flip the heartbeat.
log "=== Alerts (followed laws/MPs) ==="
"$PY" scraper/send_alerts.py >>"$LOG" 2>&1 || log "WARN: alerts send failed"

# Warm the public bulk exports (and run DB housekeeping) through the origin so
# the CDN serves same-day files without a visitor ever triggering a cold DB
# dump. The site is on Cloudflare Workers, so there is no platform cron — this
# is the only thing that calls /api/v1/refresh. CRON_SECRET must match the value
# set on Cloudflare; without it the endpoint returns 401. Non-fatal: a cache
# miss is not a data-pipeline failure.
if [ -n "${CRON_SECRET:-}" ]; then
  log "=== Warm public API cache (/api/v1/refresh) ==="
  curl -fsS --max-time 120 -H "x-cron-secret: $CRON_SECRET" \
    "https://la-butoane.ro/api/v1/refresh" >>"$LOG" 2>&1 || log "WARN: cache warm failed"
else
  log "=== Skipping cache warm — CRON_SECRET unset ==="
fi

log "=== Done (rc=$rc) ==="
exit $rc  # trap fires heartbeat here (and on any earlier exit/crash)
