// Per-colo edge cache for satori og cards. Rendering flirts with the Free
// plan's 10ms CPU cap (~1 in 3 requests dies with 1102/503); caching means one
// successful render per URL per colo and every later request skips satori
// entirely. Safe because og URLs are treated as immutable — designs bump ?v
// (CARD_V) and interval cards carry a unique signed payload — matching the
// `max-age=31536000, immutable` header ImageResponse already sends.
// `caches.default` only exists on the Workers runtime; local `next dev` and
// the Node build fall through to a plain render.

export async function withEdgeCache(req: Request, render: () => Promise<Response>): Promise<Response> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
  if (cache) {
    const hit = await cache.match(req.url).catch(() => undefined)
    if (hit) return hit
  }
  const res = await render()
  if (cache && res.status === 200) {
    try {
      // Bound the EDGE copy: ImageResponse ships max-age=31536000 immutable,
      // fine for browsers/IG (the ?v bump discipline), but the all-time cards
      // (no version param) change as votes land — cap the edge copy at 6h so
      // they refresh. Client-facing headers stay untouched.
      const copy = new Response(res.clone().body, res)
      copy.headers.set('cache-control', 'public, max-age=21600')
      await cache.put(req.url, copy)
    } catch { /* cache full/opaque — serve anyway */ }
  }
  return res
}
