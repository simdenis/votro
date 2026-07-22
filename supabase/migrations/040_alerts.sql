-- 040: email alerts — "follow" a law or an MP, get notified on new activity.
--
-- Double opt-in: subscribe → confirmation email → confirmed rows get alerts.
-- Every write goes through a SECURITY DEFINER RPC (anon can call these but has
-- NO direct table access), so the worker needs no service key and anon can't
-- read anyone's email or subscriptions. The daily sender (VPS, service role)
-- reads confirmed rows and stamps last_notified_at.

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  target_type      text NOT NULL CHECK (target_type IN ('law', 'politician')),
  target_id        uuid NOT NULL,
  token            text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  confirmed        boolean NOT NULL DEFAULT false,
  last_notified_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, target_type, target_id)
);

ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
-- no policy → anon has no direct access; all access via the RPCs below / service role

-- subscribe: upsert a (email, target) pair, return the token so the confirmation
-- email can link to it. Re-subscribing an existing pair just returns its token.
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
  INSERT INTO alert_subscriptions (email, target_type, target_id)
  VALUES (lower(p_email), p_type, p_id)
  ON CONFLICT (email, target_type, target_id) DO UPDATE SET email = EXCLUDED.email
  RETURNING token INTO v_token;
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION confirm_alert(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE alert_subscriptions SET confirmed = true WHERE token = p_token RETURNING true;
$$;

CREATE OR REPLACE FUNCTION unsubscribe_alert(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM alert_subscriptions WHERE token = p_token RETURNING true;
$$;

REVOKE ALL ON FUNCTION subscribe_alert(text, text, uuid)   FROM public;
REVOKE ALL ON FUNCTION confirm_alert(text)                 FROM public;
REVOKE ALL ON FUNCTION unsubscribe_alert(text)             FROM public;
GRANT EXECUTE ON FUNCTION subscribe_alert(text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION confirm_alert(text)               TO anon;
GRANT EXECUTE ON FUNCTION unsubscribe_alert(text)           TO anon;
