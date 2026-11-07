// Calls a signup/housekeeping RPC with the server-only SIGNUP_RPC_KEY
// (migration 060: these RPCs refuse anon callers without it).

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }

export function signupRpc(fn: string, args: Record<string, unknown>): Promise<Response> {
  return fetch(`${U}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: SB, body: JSON.stringify({ ...args, p_key: process.env.SIGNUP_RPC_KEY }),
  })
}
