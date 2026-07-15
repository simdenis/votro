import { proxy, json, cleanCode } from '@/lib/api-v1'

// GET /api/v1/laws?code=L230/2025 → the law's full journey through Parliament
// (law_status view: chamber outcomes, dates, presidential status). ?format=csv.
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('code')
  const code = cleanCode(raw)
  if (!raw) return json({ error: 'Parametrul „code” e obligatoriu (ex. L230/2025).' }, 400)
  if (!code) return json({ error: 'Cod de lege invalid.' }, 400)
  const path = `law_status?code=eq.${encodeURIComponent(code)}`
  return proxy(path, req, { filename: `lege-${code.replace(/[^\w]+/g, '-')}` })
}
