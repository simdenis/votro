// Calls a signup/housekeeping RPC with the server-only SIGNUP_RPC_KEY
// (migration 060). Transitional: if 060 isn't applied yet, PostgREST answers
// PGRST202 (no function with that signature) and we retry with the pre-060
// arguments, so deploys and the migration can land in either order.
// TODO: drop `legacy` once 060 is confirmed live.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }

export async function signupRpc(fn: string, args: Record<string, unknown>, legacy: Record<string, unknown>): Promise<Response> {
  const call = (body: Record<string, unknown>) =>
    fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: SB, body: JSON.stringify(body) })
  const r = await call({ ...args, p_key: process.env.SIGNUP_RPC_KEY })
  if (r.status !== 404) return r
  const body = await r.clone().json().catch(() => null)
  return body?.code === 'PGRST202' ? call(legacy) : r
}
