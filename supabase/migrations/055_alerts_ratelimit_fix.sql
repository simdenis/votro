-- 055: fix the alert rate-limit bypass + purge stale unconfirmed subs.
--
-- 041 counted rows created in the last hour, but re-subscribing the same
-- (email,target) hits ON CONFLICT DO UPDATE — no new row, created_at unchanged —
-- so the counter never grew and /api/alerts/subscribe re-sent a confirmation
-- email on every call → unlimited email-bombing of any address.
--
-- Fix: track every *request* (not just row inserts) in alert_request_log, bump
-- last_requested_at on the subscription, and refuse when the same (email,target)
-- was requested in the last 10 min OR the email exceeded 5 requests in the last
-- hour. subscribe_alert now returns jsonb {status, token} so the route can tell
-- "throttled" from "saved" and stop emailing.

ALTER TABLE alert_subscriptions
  ADD COLUMN IF NOT EXISTS last_requested_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS alert_request_log (
  email        text        NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alert_request_log_email_time_idx
  ON alert_request_log (email, requested_at);
ALTER TABLE alert_request_log ENABLE ROW LEVEL SECURITY;
-- no policy → only the SECURITY DEFINER RPCs / service role touch it

DROP FUNCTION IF EXISTS subscribe_alert(text, text, uuid);
CREATE FUNCTION subscribe_alert(p_email text, p_type text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text := lower(p_email);
  v_token text;
  v_last  timestamptz;
BEGIN
  IF p_type NOT IN ('law', 'politician') THEN RAISE EXCEPTION 'bad type'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'bad email';
  END IF;

  -- no repeat confirmation for the same (email,target) within 10 minutes
  SELECT last_requested_at INTO v_last FROM alert_subscriptions
   WHERE email = v_email AND target_type = p_type AND target_id = p_id;
  IF v_last IS NOT NULL AND v_last > now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('status', 'throttled');
  END IF;

  -- at most 5 confirmation emails per address per hour
  IF (SELECT count(*) FROM alert_request_log
       WHERE email = v_email AND requested_at > now() - interval '1 hour') >= 5 THEN
    RETURN jsonb_build_object('status', 'throttled');
  END IF;

  INSERT INTO alert_request_log (email) VALUES (v_email);

  INSERT INTO alert_subscriptions (email, target_type, target_id)
  VALUES (v_email, p_type, p_id)
  ON CONFLICT (email, target_type, target_id)
    DO UPDATE SET last_requested_at = now()
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END $$;

REVOKE ALL ON FUNCTION subscribe_alert(text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION subscribe_alert(text, text, uuid) TO anon;

-- Housekeeping: drop unconfirmed subscriptions older than 7 days and stale
-- request-log rows. Called nightly from the VPS flow via /api/v1/refresh
-- (CRON_SECRET-gated). anon-executable but harmless — it only removes stale
-- unconfirmed rows and can't read or exfiltrate anything.
CREATE OR REPLACE FUNCTION purge_unconfirmed_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_n integer;
BEGIN
  DELETE FROM alert_subscriptions
   WHERE confirmed = false AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  DELETE FROM alert_request_log WHERE requested_at < now() - interval '2 days';
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION purge_unconfirmed_alerts() FROM public;
GRANT EXECUTE ON FUNCTION purge_unconfirmed_alerts() TO anon;
