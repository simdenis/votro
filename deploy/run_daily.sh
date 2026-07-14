#!/usr/bin/env bash
# VotRO — scrape both chambers. Runs on an EU/RO VPS where cdep.ro is reachable.
# Usage:
#   run_daily.sh            -> scrape yesterday AND today (UTC); upserts are idempotent
#   run_daily.sh YYYY-MM-DD -> scrape a single date
set -uo pipefail

REPO_DIR="${VOTRO_REPO_DIR:-/opt/votro}"
LOG_DIR="${VOTRO_LOG_DIR:-/var/log/votro}"
PY="$REPO_DIR/scraper/.venv/bin/python"

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/scrape-$(date -u '+%Y%m%d').log"
log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG"; }

if [ -n "${1:-}" ]; then
  DATES=("$1")
else
  DATES=("$(date -u -d 'yesterday' '+%Y-%m-%d')" "$(date -u '+%Y-%m-%d')")
fi

# Preflight: cdep.ro silently drops packets from non-EU IPs. Fail fast with a
# clear message instead of eating a 25s timeout on every single request.
if ! nc -z -w 5 www.cdep.ro 443 2>/dev/null; then
  log "FATAL: cdep.ro:443 unreachable — this VPS is not on an EU/RO IP (or cdep is down)."
  exit 1
fi

cd "$REPO_DIR" || { log "FATAL: repo dir $REPO_DIR missing"; exit 1; }

# Stay current: scraper fixes land on main and must apply from the next run
# (a stale scraper once re-introduced wrong PL-x→L law links). Non-fatal.
git pull --ff-only >>"$LOG" 2>&1 || log "WARN: git pull failed — running existing code"

rc=0
for TARGET in "${DATES[@]}"; do
  log "=== Camera Deputatilor — $TARGET ==="
  "$PY" scraper/camera_scraper.py --date "$TARGET" >>"$LOG" 2>&1 || { rc=1; log "Camera scrape FAILED ($TARGET)"; }

  log "=== Senat — $TARGET ==="
  "$PY" scraper/senat_scraper.py --date "$TARGET" >>"$LOG" 2>&1 || { rc=1; log "Senat scrape FAILED ($TARGET)"; }
done

# Merge Camera-registry duplicates (PLx…) into their Senate L laws. Needs
# cdep.ro (project fisa), so it must run here on the EU VPS — the senat.ro
# PLX search the old resolver used returns zero results.
log "=== PLx → L resolution ==="
"$PY" scraper/resolve_plx.py >>"$LOG" 2>&1 || { rc=1; log "PLx resolver FAILED"; }

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

# AI categories (Haiku) for laws the title-regex classifier missed — reads the
# fresh summary, so it runs after the summarizer and before interest scoring
# (which uses the category). Only fills law_category IS NULL, ~$0.0003/law.
log "=== Law categories (Haiku) ==="
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
if [ "$(date -u +%u)" = "6" ]; then
  log "=== Weekly newsletter (Saturday) ==="
  "$PY" scraper/newsletter.py --send >>"$LOG" 2>&1 || log "WARN: newsletter send failed"
fi

# Heartbeat — lets the site footer tell "parliament idle" from "pipeline broken".
"$PY" scraper/heartbeat.py "$rc" >>"$LOG" 2>&1 || log "WARN: heartbeat write failed"

log "=== Done (rc=$rc) ==="
exit $rc
