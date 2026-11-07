import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { keyAllowed, isLockedOut, recordFailure, consumeLoginToken, sameOrigin, mintSession, verifyLoginToken, ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from '@/lib/admin-auth'

// Exchange proof-of-key for an httpOnly session cookie, so the key never rides
// in URLs or page HTML.
//   POST { key }          → login form (returns JSON)
//   GET  ?t=…&next=/admin → short-lived signed link from the approval email;
//                           sets the cookie then redirects to `next`
//                           (same-origin only). The raw key is never in a URL.

export const dynamic = 'force-dynamic'

// Fixed delay on a bad key, to slow online brute force. The compare itself is
// already constant-time (keyMatches / verify).
const failDelay = () => new Promise(r => setTimeout(r, 600))

function sessionCookie() {
  return {
    name: ADMIN_COOKIE, value: mintSession(),
    httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: ADMIN_COOKIE_MAX_AGE,
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  let key: unknown
  try { ({ key } = await req.json()) } catch { return NextResponse.json({ error: 'body invalid' }, { status: 400 }) }
  if (await isLockedOut(req)) {
    return NextResponse.json({ error: 'prea multe încercări, revino peste o oră' }, { status: 429 })
  }
  if (!(await keyAllowed(req, typeof key === 'string' ? key : null))) {
    await failDelay()
    return NextResponse.json({ error: 'cheie greșită' }, { status: 401 })
  }
  ;(await cookies()).set(sessionCookie())
  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  // only ever redirect to a same-origin path. Resolve first, then compare
  // origins: a regex on the raw string is fooled by "/\t/evil.com" (the URL
  // parser strips tabs/newlines, leaving "//evil.com").
  const self = new URL(req.url)
  // Redirect to the checked absolute URL, never re-resolve a path: a pathname
  // like "//evil.com" (from "/.//evil.com") would turn off-origin again.
  let dest = new URL('/admin', self)
  try {
    const u = new URL(sp.get('next') || '/admin', self)
    if (u.origin === self.origin) dest = u
  } catch { /* keep /admin */ }
  const t = sp.get('t')
  if (await isLockedOut(req)) {
    await failDelay()
    return NextResponse.redirect(new URL('/admin', req.url))
  }
  if (!verifyLoginToken(t)) {
    if (t) await recordFailure(req)
    await failDelay()
    return NextResponse.redirect(new URL('/admin', req.url))
  }
  // a valid but already-used link: not a guess, so no failure recorded
  if (!(await consumeLoginToken(t!))) return NextResponse.redirect(new URL('/admin', req.url))
  ;(await cookies()).set(sessionCookie())
  return NextResponse.redirect(dest)
}
