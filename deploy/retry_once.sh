#!/usr/bin/env bash
# Re-run the full scrape once, 30 min after it failed (systemd OnFailure=).
# Transient failures — cdep 503s, senat.ro timeouts, a Gemini 503 — are most of
# the rc=1 days, and every step is idempotent, so a second attempt is free.
# Once per day: a retry that fails again must not retry forever, and a data
# FAIL from validate.py (bad rows, not a flaky source) will not pass on a rerun.
set -u
MARK="/tmp/.scrape-retried-$(date -u +%Y%m%d)"
LOG="${VOTRO_LOG_DIR:-/var/log/votro}/scrape-$(date -u '+%Y%m%d').log"
if [ -f "$MARK" ]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] === Retry: already retried today — not again ===" >>"$LOG"
  exit 0
fi
touch "$MARK"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] === Retry: full run failed — re-running in 30 min ===" >>"$LOG"
sleep 1800
systemctl start votro-scrape.service
