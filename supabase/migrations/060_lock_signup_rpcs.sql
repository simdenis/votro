-- 060: signup RPCs callable only by our own Worker (pentest 2026-11-07).
--
-- subscribe_alert / newsletter_request were anon-EXECUTE and returned the
-- confirmation token, so anyone holding the public anon key could call them
-- directly, read the token and confirm a stranger's address — skipping double
-- opt-in (and the per-IP limit, since p_ip was caller-supplied). subscribe_alert
-- also handed back an existing subscription's token = its unsubscribe token.
--
-- Fix: every token-returning / housekeeping RPC now requires p_key, a server-only
-- secret (Worker secret SIGNUP_RPC_KEY). Only its SHA-256 lives here — the key
-- is 32 random bytes, so publishing the hash in this (public) repo is safe.
-- Old signatures are dropped so the unauthenticated versions disappear.
-- confirm_alert / unsubscribe_alert / newsletter_confirm stay anon: they need a
-- token the attacker can no longer get.
--
-- Also: subscribe_alert gets a per-IP limit (IP is now trustworthy: it comes from
-- the Worker's cf-connecting-ip) and its per-address limit keys on a normalized
-- address (+tag stripped, gmail dots removed) so victim+1@, v.ictim@… share one
-- budget. All SECURITY DEFINER functions pin search_path.

CREATE OR REPLACE FUNCTION _signup_key_ok(p_key text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT p_key IS NOT NULL AND encode(digest(p_key, 'sha256'), 'hex')
         = 'f8e848d4e458b4d7f6cae9416ce749b24ba2910458753af8387de3fc434a5a90'
$$;
REVOKE ALL ON FUNCTION _signup_key_ok(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION _rate_email(p_email text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(e, '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(e, '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(e, '@', 1), '+', 1) || '@' || split_part(e, '@', 2)
  END
  FROM (SELECT lower(trim(p_email)) AS e) s
$$;
REVOKE ALL ON FUNCTION _rate_email(text) FROM public, anon, authenticated;

ALTER TABLE alert_request_log ADD COLUMN IF NOT EXISTS ip text;
CREATE INDEX IF NOT EXISTS alert_request_log_ip_time_idx ON alert_request_log (ip, requested_at);

-- ── alerts ──────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS subscribe_alert(text, text, uuid);
CREATE FUNCTION subscribe_alert(p_email text, p_type text, p_id uuid, p_ip text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_rl    text;
  v_token text;
  v_last  timestamptz;
BEGIN
  IF NOT _signup_key_ok(p_key) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_type NOT IN ('law', 'politician') THEN RAISE EXCEPTION 'bad type'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'bad email';
  END IF;
  v_rl := _rate_email(v_email);

  -- no repeat confirmation for the same (email,target) within 10 minutes
  SELECT last_requested_at INTO v_last FROM alert_subscriptions
   WHERE email = v_email AND target_type = p_type AND target_id = p_id;
  IF v_last IS NOT NULL AND v_last > now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('status', 'throttled');
  END IF;

  -- ≤5 confirmation emails per (normalized) inbox per hour, ≤10 per IP per hour
  IF (SELECT count(*) FROM alert_request_log
       WHERE email = v_rl AND requested_at > now() - interval '1 hour') >= 5
     OR (p_ip IS NOT NULL AND p_ip <> '' AND (SELECT count(*) FROM alert_request_log
       WHERE ip = p_ip AND requested_at > now() - interval '1 hour') >= 10) THEN
    RETURN jsonb_build_object('status', 'throttled');
  END IF;

  INSERT INTO alert_request_log (email, ip) VALUES (v_rl, NULLIF(p_ip, ''));

  INSERT INTO alert_subscriptions (email, target_type, target_id)
  VALUES (v_email, p_type, p_id)
  ON CONFLICT (email, target_type, target_id)
    DO UPDATE SET last_requested_at = now()
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END $$;
REVOKE ALL ON FUNCTION subscribe_alert(text, text, uuid, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION subscribe_alert(text, text, uuid, text, text) TO anon;

DROP FUNCTION IF EXISTS purge_unconfirmed_alerts();
CREATE FUNCTION purge_unconfirmed_alerts(p_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_n integer;
BEGIN
  IF NOT _signup_key_ok(p_key) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM alert_subscriptions
   WHERE confirmed = false AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  DELETE FROM alert_request_log WHERE requested_at < now() - interval '2 days';
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION purge_unconfirmed_alerts(text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION purge_unconfirmed_alerts(text) TO anon;

-- ── newsletter ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS newsletter_request(text, text);
CREATE FUNCTION newsletter_request(p_email text, p_ip text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_token text;
  v_last  timestamptz;
BEGIN
  IF NOT _signup_key_ok(p_key) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'bad email';
  END IF;

  SELECT requested_at INTO v_last FROM newsletter_pending WHERE email = v_email;
  IF v_last IS NOT NULL AND v_last > now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('status', 'throttled');
  END IF;

  IF p_ip IS NOT NULL AND p_ip <> '' AND (
       SELECT count(*) FROM newsletter_request_log
        WHERE ip = p_ip AND requested_at > now() - interval '1 hour') >= 5 THEN
    RETURN jsonb_build_object('status', 'throttled');
  END IF;

  INSERT INTO newsletter_request_log (ip) VALUES (p_ip);

  INSERT INTO newsletter_pending (email)
  VALUES (v_email)
  ON CONFLICT (email) DO UPDATE SET requested_at = now()
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END $$;
REVOKE ALL ON FUNCTION newsletter_request(text, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION newsletter_request(text, text, text) TO anon;

DROP FUNCTION IF EXISTS purge_newsletter_pending();
CREATE FUNCTION purge_newsletter_pending(p_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_n integer;
BEGIN
  IF NOT _signup_key_ok(p_key) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM newsletter_pending WHERE requested_at < now() - interval '7 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  DELETE FROM newsletter_request_log WHERE requested_at < now() - interval '2 days';
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION purge_newsletter_pending(text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION purge_newsletter_pending(text) TO anon;

NOTIFY pgrst, 'reload schema';
