import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Admin auth via an httpOnly cookie instead of a ?key= URL param. The key
// never appears in a URL (referrer/history/log leak) nor in the page HTML/JS
// (httpOnly hides it from XSS) — the browser attaches the cookie automatically
// to same-origin /api/admin/* calls.
//
// The cookie holds a derived signed token (HMAC of an issued-at timestamp under
// ADMIN_KEY), never the raw key — so a leaked cookie can't be replayed as the
// master key on the header path, and it ages out on its own.

export const ADMIN_COOKIE = 'lb_admin'
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// Bumping either context version invalidates every outstanding token of that
// kind (session cookies / email links) — the recomputed HMAC no longer matches.
const SESSION_CTX = 'session-v1'
const LOGIN_CTX = 'login-v1'

function hmac(msg: string): string {
  return createHmac('sha256', process.env.ADMIN_KEY || '').update(msg).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** Constant-time key check — avoids leaking the key length/prefix via timing. */
export function keyMatches(candidate: string | undefined | null): boolean {
  const secret = process.env.ADMIN_KEY
  if (!secret || !candidate) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Session token for the cookie: `iat.<hmac>`, no server-side store. */
export function mintSession(): string {
  const iat = Math.floor(Date.now() / 1000)
  return `${iat}.${hmac(`${SESSION_CTX}:${iat}`)}`
}

function verifySession(token: string | undefined | null): boolean {
  if (!process.env.ADMIN_KEY || !token) return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const iat = Number(token.slice(0, dot))
  if (!Number.isSafeInteger(iat)) return false
  if (Math.floor(Date.now() / 1000) - iat > ADMIN_COOKIE_MAX_AGE) return false
  return safeEqualHex(token.slice(dot + 1), hmac(`${SESSION_CTX}:${iat}`))
}

/** Short-TTL token for the email link: `exp.<hmac>`. */
export function mintLoginToken(ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return `${exp}.${hmac(`${LOGIN_CTX}:${exp}`)}`
}

export function verifyLoginToken(token: string | undefined | null): boolean {
  if (!process.env.ADMIN_KEY || !token) return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const exp = Number(token.slice(0, dot))
  if (!Number.isSafeInteger(exp)) return false
  if (Math.floor(Date.now() / 1000) > exp) return false
  return safeEqualHex(token.slice(dot + 1), hmac(`${LOGIN_CTX}:${exp}`))
}

/** True when the request carries a valid admin session cookie. */
export async function isAdmin(): Promise<boolean> {
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value)
}
