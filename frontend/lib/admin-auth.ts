import { cookies } from 'next/headers'
import { timingSafeEqual } from 'node:crypto'

// Admin auth via an httpOnly cookie instead of a ?key= URL param. The key
// never appears in a URL (referrer/history/log leak) nor in the page HTML/JS
// (httpOnly hides it from XSS) — the browser attaches the cookie automatically
// to same-origin /api/admin/* calls.

export const ADMIN_COOKIE = 'lb_admin'
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/** Constant-time key check — avoids leaking the key length/prefix via timing. */
export function keyMatches(candidate: string | undefined | null): boolean {
  const secret = process.env.ADMIN_KEY
  if (!secret || !candidate) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** True when the request carries a valid admin cookie. */
export async function isAdmin(): Promise<boolean> {
  return keyMatches((await cookies()).get(ADMIN_COOKIE)?.value)
}
