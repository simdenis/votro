-- 041: rate-limit alert subscriptions per email (anti-abuse).
--
-- /api/alerts/subscribe sends a confirmation email on each call. Without a limit
-- someone could POST a victim's address in a loop → email-bombing + burned
-- Resend quota. The RPC is the natural chokepoint (it has state): cap a single
-- email to 5 new subscriptions per hour; the route then can't send more.

CREATE OR REPLACE FUNCTION subscribe_alert(p_email text, p_type text, p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_token text;
BEGIN
  IF p_type NOT IN ('law', 'politician') THEN RAISE EXCEPTION 'bad type'; END IF;
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' OR length(p_email) > 254 THEN
    RAISE EXCEPTION 'bad email';
  END IF;
  IF (SELECT count(*) FROM alert_subscriptions
      WHERE email = lower(p_email) AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'rate limit';
  END IF;
  INSERT INTO alert_subscriptions (email, target_type, target_id)
  VALUES (lower(p_email), p_type, p_id)
  ON CONFLICT (email, target_type, target_id) DO UPDATE SET email = EXCLUDED.email
  RETURNING token INTO v_token;
  RETURN v_token;
END $$;
