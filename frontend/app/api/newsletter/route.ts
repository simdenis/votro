import { NextResponse } from 'next/server'

// Newsletter signup — double opt-in. POST stages the address (newsletter_request
// RPC, anon-callable, rate-limited) and emails a confirmation link; the address
// only enters the Resend audience once /api/newsletter/confirm is POSTed. This
// stops anyone subscribing a third-party address on an unauthenticated POST.
// Env: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, RESEND_API_KEY, NEWSLETTER_FROM.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function clientIp(request: Request): string {
  const h = request.headers
  return (h.get('cf-connecting-ip')
    || (h.get('x-forwarded-for') ?? '').split(',')[0].trim()
    || '').slice(0, 64)
}

export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Newsletter indisponibil momentan.' }, { status: 503 })
  }

  let email: unknown
  try {
    ({ email } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 400 })
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return NextResponse.json({ error: 'Adresa de email nu pare validă.' }, { status: 400 })
  }
  const addr = email.trim().toLowerCase()

  let result: { status?: string; token?: string }
  try {
    const rpc = await fetch(`${U}/rest/v1/rpc/newsletter_request`, {
      method: 'POST', headers: SB,
      body: JSON.stringify({ p_email: addr, p_ip: clientIp(request) }),
    })
    if (!rpc.ok) return NextResponse.json({ error: 'Nu am putut salva abonarea. Încearcă din nou.' }, { status: 502 })
    result = await rpc.json()
  } catch {
    return NextResponse.json({ error: 'Nu am putut salva abonarea. Încearcă din nou.' }, { status: 502 })
  }
  // Throttled or already-pending: answer as success (don't leak state, don't
  // re-send). Only "ok" mints a fresh token to email.
  if (result?.status !== 'ok' || !result.token) {
    return NextResponse.json({ ok: true })
  }

  const from = process.env.NEWSLETTER_FROM || 'LaButoane <alerte@la-butoane.ro>'
  const confirm = `${SITE}/api/newsletter/confirm?token=${result.token}`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [addr],
        subject: 'Confirmă abonarea la newsletter',
        html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#171A1F;">
          <h2 style="margin:24px 0 8px;">Un pas: confirmă</h2>
          <p style="color:#6E7480;margin:0 0 20px;">Apasă butonul ca să primești newsletterul săptămânal LaButoane.</p>
          <p><a href="${confirm}" style="display:inline-block;background:#171A1F;color:#fff;text-decoration:none;border-radius:8px;padding:12px 22px;font-weight:600;">Confirmă abonarea</a></p>
          <p style="color:#9aa0aa;font-size:12px;margin-top:28px;">Nu tu ai cerut asta? Ignoră emailul — nu vei primi nimic.</p>
        </div>`,
      }),
    })
    if (!r.ok) return NextResponse.json({ error: 'Nu am putut trimite emailul de confirmare.' }, { status: 502 })
  } catch {
    return NextResponse.json({ error: 'Nu am putut trimite emailul de confirmare.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
