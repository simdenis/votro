#!/usr/bin/env bash
# VotRO VPS provisioning — run as root on a fresh Debian 12 / Ubuntu 24.04 EU box.
#   REPO_URL=https://github.com/simdenis/votro.git bash setup.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/simdenis/votro.git}"
REPO_DIR=/opt/votro

echo "==> Installing system packages"
apt-get update
apt-get install -y python3 python3-venv python3-pip git netcat-openbsd

echo "==> Creating service user 'votro'"
id votro &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin votro

echo "==> Cloning / updating repo at $REPO_DIR"
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  git -C "$REPO_DIR" pull --ff-only
fi
chown -R votro:votro "$REPO_DIR"
chmod +x "$REPO_DIR/deploy/run_daily.sh"

echo "==> Python venv + dependencies"
sudo -u votro python3 -m venv "$REPO_DIR/scraper/.venv"
sudo -u votro "$REPO_DIR/scraper/.venv/bin/pip" install --upgrade pip
sudo -u votro "$REPO_DIR/scraper/.venv/bin/pip" install -r "$REPO_DIR/scraper/requirements.txt"

echo "==> Log dir"
mkdir -p /var/log/votro && chown votro:votro /var/log/votro

if [ ! -f "$REPO_DIR/.env" ]; then
  cat <<EOF

  !! No .env found. Create $REPO_DIR/.env now:
       SUPABASE_URL=https://<ref>.supabase.co
       SUPABASE_KEY=<service-role-key>
     Then:  chown votro:votro $REPO_DIR/.env && chmod 600 $REPO_DIR/.env
     (See $REPO_DIR/.env.example)

EOF
fi

echo "==> Installing systemd timer"
install -m644 "$REPO_DIR/deploy/votro-scrape.service" /etc/systemd/system/
install -m644 "$REPO_DIR/deploy/votro-scrape.timer"   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now votro-scrape.timer

echo
echo "Done. Next:"
echo "  1. Confirm EU egress + cdep reachable, run one scrape now:"
echo "       sudo -u votro $REPO_DIR/deploy/run_daily.sh"
echo "  2. Check the timer:   systemctl list-timers votro-scrape.timer"
echo "  3. Tail today's log:  tail -f /var/log/votro/scrape-\$(date -u +%Y%m%d).log"
