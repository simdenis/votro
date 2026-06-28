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

rc=0
for TARGET in "${DATES[@]}"; do
  log "=== Camera Deputatilor — $TARGET ==="
  "$PY" scraper/camera_scraper.py --date "$TARGET" >>"$LOG" 2>&1 || { rc=1; log "Camera scrape FAILED ($TARGET)"; }

  log "=== Senat — $TARGET ==="
  "$PY" scraper/senat_scraper.py --date "$TARGET" >>"$LOG" 2>&1 || { rc=1; log "Senat scrape FAILED ($TARGET)"; }
done

log "=== Done (rc=$rc) ==="
exit $rc
