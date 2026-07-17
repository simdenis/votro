import { json } from '@/lib/api-v1'

// GET /api/v1 → self-describing index of the public open-data API.
export async function GET() {
  return json({
    name: 'LaButoane open-data API',
    descriere: 'Date publice despre voturile din Parlamentul României. Read-only, fără cheie, fără cont. Adaugă ?format=csv pentru CSV.',
    endpoints: {
      'GET /api/v1/votes?code=L230/2025': 'Voturile pe o lege',
      'GET /api/v1/votes?from=2026-01-01&to=2026-06-30&camera=senat': 'Voturile dintr-o perioadă',
      'GET /api/v1/laws?code=L230/2025': 'Drumul unei legi prin Parlament',
      'GET /api/v1/parlamentari?camera=camera&nume=Ponta': 'Statistici de vot per parlamentar',
      'GET /api/v1/parlamentari?camera=camera&nume=Ponta&voturi=1': 'Toate voturile unui parlamentar (lege, votul lui, linia de partid)',
      'GET /api/v1/export/{voturi|legi|deputati|senatori}': 'Set complet (fișier, actualizat zilnic)',
    },
    licenta: 'Date din surse publice (senat.ro, cdep.ro). Atribuire apreciată.',
  }, 200)
}
