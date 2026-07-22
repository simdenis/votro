// GET ?token=… → confirm a subscription (confirm_alert RPC). Returns a small
// HTML page. The token is single-use-ish (idempotent) and unguessable (24 bytes).

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
     <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:440px;margin:18vh auto;padding:0 20px;text-align:center;color:#171A1F;">
       <div style="font-size:40px">🔔</div><h1 style="font-size:22px">${title}</h1><p style="color:#6E7480">${body}</p>
       <p><a href="${SITE}" style="color:#4E86D8;">← Înapoi la LaButoane</a></p></div>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f]{48}$/.test(token)) return page('Link invalid', 'Tokenul lipsește sau e greșit.')
  const r = await fetch(`${U}/rest/v1/rpc/confirm_alert`, {
    method: 'POST',
    headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  })
  const ok = r.ok && (await r.json()) === true
  return ok
    ? page('Gata! Ești abonat', 'Vei primi un email când apar noutăți. Te poți dezabona oricând din orice email.')
    : page('Link expirat', 'Abonarea nu a putut fi confirmată (poate era deja confirmată sau ștearsă).')
}
