-- 038: lock down the matview-refresh RPCs (SECURITY FIX).
--
-- refresh_party_agreement (029/030) and refresh_monthly_absences (036) are
-- SECURITY DEFINER and expensive — refresh_party_agreement runs ~26s of DB
-- compute. They were meant for the VPS (service_role) only, but Postgres grants
-- EXECUTE to PUBLIC by default on function creation, and that default was never
-- revoked, so the anon API key could call them. An unauthenticated loop over
-- refresh_party_agreement is a cheap denial-of-service against the whole DB.
--
-- Revoke EXECUTE from every web-facing role explicitly (REVOKE FROM public
-- alone proved insufficient in this project's grant setup — anon/authenticated
-- retained access). The frontend never calls these (it uses only the anon key
-- for reads); only the VPS scrape, which holds service_role, needs them.

REVOKE EXECUTE ON FUNCTION refresh_party_agreement()  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refresh_monthly_absences() FROM public, anon, authenticated;

GRANT  EXECUTE ON FUNCTION refresh_party_agreement()  TO service_role;
GRANT  EXECUTE ON FUNCTION refresh_monthly_absences() TO service_role;
