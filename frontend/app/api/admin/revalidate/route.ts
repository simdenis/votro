import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAdmin, keyMatches } from '@/lib/admin-auth'

// On-demand ISR refresh. The homepage (and other detail pages) cache for ~10
// min; after a data change (e.g. moving senators into PACE) you don't want to
// wait for the timer. POST { path } or { paths: [...] } (default '/') and the
// cached render is dropped so the next hit regenerates.
//
// Auth mirrors /api/admin/publish: the httpOnly admin cookie, or X-Admin-Key.
// Unauthorized → 404 (don't advertise the endpoint).
export async function POST(req: NextRequest) {
  if (!(await isAdmin()) && !keyMatches(req.headers.get('x-admin-key'))) {
    return new Response('Not found', { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as { path?: string; paths?: string[] }
  const paths = body.paths?.length
    ? body.paths.filter(p => typeof p === 'string' && p.startsWith('/'))
    : [typeof body.path === 'string' && body.path.startsWith('/') ? body.path : '/']

  for (const p of paths) revalidatePath(p)
  return Response.json({ revalidated: paths, at: new Date().toISOString() })
}
