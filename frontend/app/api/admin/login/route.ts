import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { keyMatches, ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from '@/lib/admin-auth'

// Exchange the admin key for an httpOnly session cookie, so the key stops
// riding in URLs and page HTML.
//   POST { key }            → login form (returns JSON)
//   GET  ?key=…&next=/admin → one-time link from the approval email; sets the
//                             cookie then redirects to `next` (same-origin only),
//                             stripping the key from the visible URL.

export const dynamic = 'force-dynamic'

// Fixed delay on a bad key, to slow online brute force. The compare itself is
// already constant-time (keyMatches).
const failDelay = () => new Promise(r => setTimeout(r, 600))

function setCookie() {
  return {
    name: ADMIN_COOKIE, value: process.env.ADMIN_KEY!,
    httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: ADMIN_COOKIE_MAX_AGE,
  }
}

export async function POST(req: Request) {
  let key: unknown
  try { ({ key } = await req.json()) } catch { return NextResponse.json({ error: 'body invalid' }, { status: 400 }) }
  if (!keyMatches(typeof key === 'string' ? key : null)) {
    await failDelay()
    return NextResponse.json({ error: 'cheie greșită' }, { status: 401 })
  }
  ;(await cookies()).set(setCookie())
  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  // only ever redirect to a same-origin path — never an absolute/attacker URL.
  // Must start with a single "/" not followed by "/" or "\": WHATWG parsing
  // treats "\" as "/", so "/\evil.com" and "//evil.com" are both off-origin.
  const nextParam = sp.get('next') || '/admin'
  const dest = /^\/(?![/\\])/.test(nextParam) ? nextParam : '/admin'
  if (!keyMatches(sp.get('key'))) {
    await failDelay()
    return NextResponse.redirect(new URL('/admin', req.url))
  }
  ;(await cookies()).set(setCookie())
  return NextResponse.redirect(new URL(dest, req.url))
}
