import { cookies, headers } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { jwtVerify, createRemoteJWKSet } from 'jose'

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

// Cloudflare Access sits in front of /admin: it authenticates the owner's Gmail
// at the edge and forwards a signed JWT (Cf-Access-Jwt-Assertion header on
// Access-gated paths, CF_Authorization cookie everywhere else on the domain).
// Trusting it makes Access the single sign-in; the /api/admin/* routes stay off
// Access (VPS uses the x-admin-key header), so they verify the same cookie here.
const CF_TEAM = process.env.CF_ACCESS_TEAM_DOMAIN || 'jolly-disk-909f.cloudflareaccess.com'
const CF_AUD = process.env.CF_ACCESS_AUD || '0d1c5281937706cdaaf42e94e69acab209945cd5bca13d300de0a9cdd39b4c05'
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'siminiucdenis@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const JWKS = createRemoteJWKSet(new URL(`https://${CF_TEAM}/cdn-cgi/access/certs`))

async function verifyAccessJwt(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://${CF_TEAM}`, audience: CF_AUD })
    return ADMIN_EMAILS.includes(String(payload.email ?? '').toLowerCase())
  } catch {
    return false
  }
}

/** True when the request is a Cloudflare Access session for an allowed email,
 *  or (fallback) carries a valid legacy admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const jwt = (await headers()).get('cf-access-jwt-assertion')
    ?? (await cookies()).get('CF_Authorization')?.value
  if (await verifyAccessJwt(jwt)) return true
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value)
}
