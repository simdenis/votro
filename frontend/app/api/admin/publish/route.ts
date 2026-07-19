// Publish a post to Instagram from the admin page (/admin).
//
// POST { images: string[], caption: string } + X-Admin-Key header.
// 1 image → single post; 2–6 → carousel. Ports the container flow from
// scraper/instagram_poster.py: create container(s) → poll status_code until
// FINISHED → media_publish. All IG calls are IO, not CPU, so the Free-plan
// 10ms CPU cap is not a problem here (unlike the satori og routes).
//
// Auth: the httpOnly admin cookie (set via /api/admin/login), or the
// X-Admin-Key header as a fallback; neither → 404 (don't advertise the
// endpoint). Needs IG_USER_ID + IG_ACCESS_TOKEN secrets —
// NB: the 60-day token refreshed via `--refresh-token` must be re-uploaded with
// `wrangler secret put IG_ACCESS_TOKEN` or this route's copy goes stale.
//
// Images are restricted to our own origin so a leaked key can't turn the
// account into an open relay for arbitrary pictures.

import { isAdmin, keyMatches } from '@/lib/admin-auth'

const GRAPH = 'https://graph.instagram.com'
const V = process.env.GRAPH_API_VERSION || 'v21.0'
// Free plan allows 50 subrequests/request — 6 slides worst-case stays under it.
const MAX_IMAGES = 6
const POLL_ROUNDS = 5
const POLL_DELAY_MS = 2500

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function igPost(path: string, params: Record<string, string>): Promise<any> {
  const r = await fetch(`${GRAPH}/${V}/${path}?` + new URLSearchParams(params), { method: 'POST' })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${path} failed (${r.status}): ${JSON.stringify(body).slice(0, 300)}`)
  return body
}

async function igGet(path: string, params: Record<string, string>): Promise<any> {
  const r = await fetch(`${GRAPH}/${V}/${path}?` + new URLSearchParams(params))
  return r.json().catch(() => ({}))
}

/** Poll the given containers (in parallel rounds) until all FINISHED. */
async function waitReady(ids: string[], token: string): Promise<void> {
  let pending = ids
  for (let round = 0; round < POLL_ROUNDS && pending.length; round++) {
    await sleep(POLL_DELAY_MS)
    const status = await Promise.all(pending.map(id =>
      igGet(id, { fields: 'status_code,status', access_token: token }).then(s => ({ id, s }))))
    const err = status.find(({ s }) => s.status_code === 'ERROR')
    if (err) throw new Error(`container ${err.id} error: ${JSON.stringify(err.s).slice(0, 300)}`)
    pending = status.filter(({ s }) => s.status_code !== 'FINISHED').map(({ id }) => id)
  }
  if (pending.length) throw new Error(`containers not ready in time: ${pending.join(', ')}`)
}

export async function POST(req: Request) {
  // cookie (normal path) OR X-Admin-Key header (legacy/scripts)
  if (!(await isAdmin()) && !keyMatches(req.headers.get('x-admin-key'))) {
    return new Response('Not found', { status: 404 })
  }
  const userId = process.env.IG_USER_ID
  const token = process.env.IG_ACCESS_TOKEN
  if (!userId || !token) {
    return Response.json({ error: 'IG_USER_ID / IG_ACCESS_TOKEN nu sunt setate pe worker' }, { status: 500 })
  }

  let images: string[], caption: string, story: boolean
  try {
    const body = await req.json()
    images = (body.images as string[]).map(u => String(u).trim()).filter(Boolean)
    caption = String(body.caption ?? '')
    story = Boolean(body.story)
  } catch {
    return Response.json({ error: 'body invalid' }, { status: 400 })
  }
  if (story && images.length !== 1) {
    return Response.json({ error: 'un story = exact o imagine' }, { status: 400 })
  }
  const origin = new URL(req.url).origin
  const site = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, '')
  if (images.length < 1 || images.length > MAX_IMAGES) {
    return Response.json({ error: `1–${MAX_IMAGES} imagini, ai trimis ${images.length}` }, { status: 400 })
  }
  if (images.some(u => !(u.startsWith(site + '/') || u.startsWith(origin + '/')))) {
    return Response.json({ error: 'doar imagini de pe domeniul propriu' }, { status: 400 })
  }

  try {
    let creationId: string
    if (story) {
      // stories: no caption, 24h lifetime; IG letterboxes the 4:5 card on 9:16
      creationId = (await igPost(`${userId}/media`,
        { media_type: 'STORIES', image_url: images[0], access_token: token })).id
      await waitReady([creationId], token)
    } else if (images.length === 1) {
      creationId = (await igPost(`${userId}/media`,
        { image_url: images[0], caption, access_token: token })).id
      await waitReady([creationId], token)
    } else {
      const children: string[] = []
      for (const url of images) {
        children.push((await igPost(`${userId}/media`,
          { image_url: url, is_carousel_item: 'true', access_token: token })).id)
      }
      await waitReady(children, token)
      creationId = (await igPost(`${userId}/media`,
        { media_type: 'CAROUSEL', children: children.join(','), caption, access_token: token })).id
      await waitReady([creationId], token)
    }
    const mediaId = (await igPost(`${userId}/media_publish`,
      { creation_id: creationId, access_token: token })).id
    const { permalink } = await igGet(mediaId, { fields: 'permalink', access_token: token })
    return Response.json({ mediaId, permalink: permalink ?? null })
  } catch (e) {
    // IG's fetcher can hit a 503 render (CPU cap) — the client offers a retry.
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
