// Unsubscribe (unsubscribe_alert RPC). The emailed link is a GET that only
// RENDERS an unsubscribe button — the delete happens on POST. Mail-scanner
// prefetchers issue GETs, so a GET must never mutate or they'd auto-unsubscribe.
// The token is the auth; linked from every alert email.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')

function page(title: string, body: string, form?: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
     <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:440px;margin:18vh auto;padding:0 20px;text-align:center;color:#171A1F;">
       <h1 style="font-size:22px">${title}</h1><p style="color:#6E7480">${body}</p>
       ${form ?? ''}
       <p><a href="${SITE}" style="color:#4E86D8;">← Înapoi la LaButoane</a></p></div>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

const btn = (token: string) =>
  `<form method="post" style="margin:8px 0 20px;">
     <input type="hidden" name="token" value="${token}">
     <button type="submit" style="background:#171A1F;color:#fff;border:0;border-radius:8px;padding:12px 22px;font-weight:600;font-size:15px;cursor:pointer;">Dezabonează-mă</button>
   </form>`

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f]{48}$/.test(token)) return page('Link invalid', 'Tokenul lipsește sau e greșit.')
  return page('Dezabonare', 'Apasă butonul de mai jos ca să nu mai primești alerte pentru asta.', btn(token))
}

export async function POST(req: Request) {
  let token = new URL(req.url).searchParams.get('token') ?? ''
  if (!token) {
    try { token = String((await req.formData()).get('token') ?? '') } catch { /* empty */ }
  }
  if (!/^[0-9a-f]{48}$/.test(token)) return page('Link invalid', 'Tokenul lipsește sau e greșit.')
  await fetch(`${U}/rest/v1/rpc/unsubscribe_alert`, {
    method: 'POST',
    headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  }).catch(() => {})
  return page('Te-ai dezabonat', 'Nu vei mai primi alerte pentru asta. Ne pare rău să te vedem plecând!')
}
