# VotRO scraper — VPS deployment

cdep.ro silently drops packets from non-EU IPs (no 403, no RST — just a
timeout). GitHub Actions runners use US/Azure IPs, so the Camera scrape can
**never** work there. The fix is to run the daily scrape from an EU/RO VPS.
senat.ro works from anywhere; only cdep.ro needs the EU egress.

This was verified: a Belgium (EU) exit IP gets `HTTP 200` from cdep; a US IP
times out at the TCP layer.

## 1. Get a cheap EU VPS

Any EU IP works (confirmed). Cheapest reliable options:

| Host       | Location          | Price       |
|------------|-------------------|-------------|
| Hetzner    | Germany / Finland | ~€4/mo (CX22) |
| Contabo    | Germany           | ~€5/mo      |
| a RO host  | Romania           | guaranteed RO IP |

Pick Debian 12 or Ubuntu 24.04. A Romanian host is the 100% guarantee, but any
EU IP has tested fine.

## 2. Provision

SSH in as root and run:

```bash
REPO_URL=https://github.com/simdenis/votro.git \
  bash <(curl -fsSL https://raw.githubusercontent.com/simdenis/votro/main/deploy/setup.sh)
```

(If the repo is **private**, clone it manually with a token first, then run
`bash /opt/votro/deploy/setup.sh`.)

The script: installs Python + git, creates a `votro` service user, clones the
repo to `/opt/votro`, builds the venv, installs the systemd **timer**, and
enables it.

## 3. Add secrets

```bash
nano /opt/votro/.env        # SUPABASE_URL + SUPABASE_KEY (see .env.example)
chown votro:votro /opt/votro/.env && chmod 600 /opt/votro/.env
```

## 4. Verify

```bash
# One manual run (yesterday + today) — proves EU egress + DB write work:
sudo -u votro /opt/votro/deploy/run_daily.sh

# Backfill a specific date:
sudo -u votro /opt/votro/deploy/run_daily.sh 2026-06-18

systemctl list-timers votro-scrape.timer          # next fire time
tail -f /var/log/votro/scrape-$(date -u +%Y%m%d).log
```

The timer fires twice daily (Romanian local time, DST-aware): **17:00 RO** to
catch today's plenary votes the same day, and **09:00 RO** to catch yesterday
fully (late publishes / corrections). Each run scrapes both yesterday and today;
upserts are idempotent so the overlap is harmless. `Persistent=true` means a
reboot/downtime won't skip a run.

## 5. Updating the code

```bash
git -C /opt/votro pull --ff-only
sudo -u votro /opt/votro/scraper/.venv/bin/pip install -r /opt/votro/scraper/requirements.txt
```

## Notes

- The daily GitHub Actions cron has been removed (it owned scheduling before but
  cdep blocks its IPs). `scrape.yml` remains for **manual** `workflow_dispatch`
  runs only — fine for senat, will fail for camera from GitHub's US IPs.
- `run_daily.sh` does a fast `nc` preflight to cdep:443 and aborts with a clear
  message if the VPS somehow isn't on an EU IP, instead of hanging 25s/request.
