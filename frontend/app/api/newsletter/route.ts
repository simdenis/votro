import { NextResponse } from 'next/server'

// Newsletter signup — adds the address to the Resend audience (single source
// of truth for subscribers; unsubscribe is handled by Resend's broadcast
// links, so no PII lands in our own DB).
// Env: RESEND_API_KEY, RESEND_AUDIENCE_ID.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY
  const audience = process.env.RESEND_AUDIENCE_ID
  if (!key || !audience) {
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

  const r = await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), unsubscribed: false }),
  })
  // Resend answers 201 on create and 409-ish on duplicates — both are a win
  // for the user, so don't leak whether an address was already subscribed.
  if (!r.ok && r.status !== 409) {
    return NextResponse.json({ error: 'Nu am putut salva abonarea. Încearcă din nou.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
