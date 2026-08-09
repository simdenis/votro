-- 056: newsletter double opt-in + rate limiting.
--
-- /api/newsletter used to add any address straight to the Resend audience on a
-- single unauthenticated POST — anyone could subscribe a third party (burning
-- Resend quota, harming sender reputation, no consent). Mirror the alerts flow:
-- POST stages the address here and emails a confirmation link; only on confirm
-- does the address enter the Resend audience (which the weekly sender reads).
--
-- Both writes go through SECURITY DEFINER RPCs (anon-callable, no table access),
-- with a rate limit: no repeat confirmation to the same address within 10 min,
-- and ≤5 requests per IP per hour.

CREATE TABLE IF NOT EXISTS newsletter_pending (
  email        text        NOT NULL UNIQUE,
  token        text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE newsletter_pending ENABLE ROW LEVEL SECURITY;
-- no policy → access only via the RPCs below / service role

CREATE TABLE IF NOT EXISTS newsletter_request_log (
  ip           text,
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS newsletter_request_log_ip_time_idx
  ON newsletter_request_log (ip, requested_at);
ALTER TABLE newsletter_request_log ENABLE ROW LEVEL SECURITY;

-- stage a pending signup, return {status, token}. "throttled" → no email.
CREATE OR REPLACE FUNCTION newsletter_request(p_email text, p_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_token text;
  v_last  timestamptz;
BEGIN
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

-- confirm a pending signup: consume the row, return the email so the route can
-- add it to the Resend audience. Returns null on an unknown/expired token.
CREATE OR REPLACE FUNCTION newsletter_confirm(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_email text;
BEGIN
  DELETE FROM newsletter_pending WHERE token = p_token RETURNING email INTO v_email;
  RETURN v_email;
END $$;

-- purge stale unconfirmed signups + old rate-limit rows. Called nightly from the
-- VPS flow via /api/v1/refresh.
CREATE OR REPLACE FUNCTION purge_newsletter_pending()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_n integer;
BEGIN
  DELETE FROM newsletter_pending WHERE requested_at < now() - interval '7 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  DELETE FROM newsletter_request_log WHERE requested_at < now() - interval '2 days';
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION newsletter_request(text, text)  FROM public;
REVOKE ALL ON FUNCTION newsletter_confirm(text)        FROM public;
REVOKE ALL ON FUNCTION purge_newsletter_pending()      FROM public;
GRANT EXECUTE ON FUNCTION newsletter_request(text, text) TO anon;
GRANT EXECUTE ON FUNCTION newsletter_confirm(text)       TO anon;
GRANT EXECUTE ON FUNCTION purge_newsletter_pending()     TO anon;
