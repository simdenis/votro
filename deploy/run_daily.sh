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

# Presidential / CCR status is law-based, not date-based: re-check laws that
# passed both chambers but have no promulgation status yet (senat.ro journey).
log "=== Presidential / CCR status (senat.ro) ==="
"$PY" scraper/presidential_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Presidential scrape FAILED"; }

# Authoritative promulgation source: presidency.ro decrees (senat.ro's fisa
# often omits them). Clears a JS proof-of-work, resolves PL-x → L via cdep.
log "=== Presidential decrees (presidency.ro) ==="
"$PY" scraper/presidential_decree_scraper.py --years "$(date -u '+%Y')" >>"$LOG" 2>&1 || { rc=1; log "Decree scrape FAILED"; }

# Law summaries from the expunere de motive PDF (no AI). Only processes laws not
# yet checked (summary_checked_at IS NULL), so this is incremental and cheap.
log "=== Law summaries ==="
"$PY" scraper/law_summarizer.py >>"$LOG" 2>&1 || { rc=1; log "Law summarizer FAILED"; }

# Active mandates + electoral county from the official member lists. Never
# mass-deactivates on a broken parse (sanity floors inside).
log "=== Roster (active mandates + county) ==="
"$PY" scraper/roster_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Roster scrape FAILED"; }

# Bills with running tacit-adoption terms (cdep "Verificare termene legale").
log "=== Tacit deadlines ==="
"$PY" scraper/tacit_scraper.py >>"$LOG" 2>&1 || { rc=1; log "Tacit scrape FAILED"; }

# Heartbeat — lets the site footer tell "parliament idle" from "pipeline broken".
"$PY" scraper/heartbeat.py "$rc" >>"$LOG" 2>&1 || log "WARN: heartbeat write failed"

log "=== Done (rc=$rc) ==="
exit $rc
