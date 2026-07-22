import { NextResponse } from 'next/server'

// POST { email, targetType: 'law'|'politician', targetId } → create a pending
// subscription (via the subscribe_alert RPC, anon-callable) and email a
// confirmation link (double opt-in). No service key needed.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function targetLabel(type: string, id: string): Promise<string> {
  try {
    if (type === 'law') {
      const r = await fetch(`${U}/rest/v1/laws?id=eq.${id}&select=code&limit=1`, { headers: SB })
      return `legea ${((await r.json())?.[0]?.code) ?? ''}`.trim()
    }
    const r = await fetch(`${U}/rest/v1/politicians?id=eq.${id}&select=first_name,name&limit=1`, { headers: SB })
    const p = (await r.json())?.[0]
    return p ? `${p.first_name} ${p.name}` : 'acest parlamentar'
  } catch { return type === 'law' ? 'această lege' : 'acest parlamentar' }
}

export async function POST(req: Request) {
  let email: unknown, targetType: unknown, targetId: unknown
  try { ({ email, targetType, targetId } = await req.json()) } catch { return NextResponse.json({ error: 'body invalid' }, { status: 400 }) }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return NextResponse.json({ error: 'Adresă de email invalidă.' }, { status: 400 })
  }
  if ((targetType !== 'law' && targetType !== 'politician') || typeof targetId !== 'string') {
    return NextResponse.json({ error: 'țintă invalidă' }, { status: 400 })
  }

  // create/upsert the pending subscription → token
  const rpc = await fetch(`${U}/rest/v1/rpc/subscribe_alert`, {
    method: 'POST', headers: SB,
    body: JSON.stringify({ p_email: email.trim(), p_type: targetType, p_id: targetId }),
  })
  if (!rpc.ok) return NextResponse.json({ error: 'Nu am putut salva abonarea.' }, { status: 502 })
  const token = await rpc.json() as string

  const key = process.env.RESEND_API_KEY
  if (key) {
    const label = await targetLabel(targetType, targetId)
    const from = process.env.NEWSLETTER_FROM || 'LaButoane <alerte@la-butoane.ro>'
    const confirm = `${SITE}/api/alerts/confirm?token=${token}`
    const unsub = `${SITE}/api/alerts/unsubscribe?token=${token}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [email.trim()],
        subject: `Confirmă alertele pentru ${label}`,
        html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#171A1F;">
          <h2 style="margin:24px 0 8px;">Un pas: confirmă</h2>
          <p style="color:#6E7480;margin:0 0 20px;">Vei primi un email când apar noutăți despre <strong>${label}</strong> (un vot nou, promulgare).</p>
          <p><a href="${confirm}" style="display:inline-block;background:#171A1F;color:#fff;text-decoration:none;border-radius:8px;padding:12px 22px;font-weight:600;">Confirmă abonarea</a></p>
          <p style="color:#9aa0aa;font-size:12px;margin-top:28px;">Nu tu ai cerut asta? Ignoră emailul — nu vei primi nimic. <a href="${unsub}" style="color:#9aa0aa;">Dezabonare</a>.</p>
        </div>`,
      }),
    }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
