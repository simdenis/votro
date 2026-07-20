import { getDB } from '@/lib/supabase'
import { isAdmin, keyMatches } from '@/lib/admin-auth'
import { lawSlides, lawCarouselCaption, initiatorLineFromRows } from '@/lib/ig-carousel'
import { isUuid } from '@/lib/utils'
import type { LawStatus } from '@/lib/types'

// Full carousel deck for one law — so the manual publisher can expand a
// /legi/<id> link into hook → summary → chambers → deviation (the same deck the
// candidate sections build). Cookie-gated like the rest of /api/admin/*.
// GET ?id=<uuid> → { slides: [{url,label}], caption }

export const dynamic = 'force-dynamic'
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')

export async function GET(req: Request) {
  if (!(await isAdmin()) && !keyMatches(req.headers.get('x-admin-key'))) {
    return new Response('Not found', { status: 404 })
  }
  const id = isUuid(new URL(req.url).searchParams.get('id')) ? new URL(req.url).searchParams.get('id') : null
  if (!id) return Response.json({ error: 'bad id' }, { status: 400 })

  const db = getDB()
  const [{ data: statuses }, { data: lawRow }, { data: initiators }] = await Promise.all([
    db.from('law_status').select('*').eq('law_id', id).limit(1),
    db.from('laws').select('headline, initiator_type').eq('id', id).limit(1),
    db.from('law_initiators').select('role_raw, party_raw').eq('law_id', id),
  ])
  const status = statuses?.[0] as LawStatus | undefined
  if (!status) return Response.json({ error: 'law not found' }, { status: 404 })
  const headline = (lawRow?.[0]?.headline as string | null) ?? null

  const voteIds = [status.senate_vote_id, status.camera_vote_id].filter((v): v is string => Boolean(v))
  const { data: devRows } = voteIds.length
    ? await db.from('politician_votes').select('vote_id').in('vote_id', voteIds).eq('party_line_deviation', true)
    : { data: [] }
  const devByVote = new Map<string, number>()
  for (const r of devRows ?? []) devByVote.set(r.vote_id, (devByVote.get(r.vote_id) ?? 0) + 1)
  let devVote: string | null = null, devCount = 0
  for (const vid of voteIds) if ((devByVote.get(vid) ?? 0) > devCount) { devVote = vid; devCount = devByVote.get(vid)! }

  const initiator = initiatorLineFromRows(lawRow?.[0]?.initiator_type ?? null, initiators ?? [])
  // suffix already starts with "og/" → /api/<suffix>, NOT /api/og/<suffix>
  const slides = lawSlides(status, devVote, Boolean(headline))
    .map(s => ({ url: `${SITE}/api/${s.suffix}`, label: s.label }))
  const caption = lawCarouselCaption(status, { initiator, devCount, headline })
  return Response.json({ slides, caption })
}
