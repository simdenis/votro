import { notFound } from 'next/navigation'
import { getDB } from '@/lib/supabase'
import { VoteCard } from '@/components/cards/vote-card'
import { mapVoteToCard } from '@/lib/votecard'

export const dynamic = 'force-dynamic'

// On-screen preview of the 1080×1080 Instagram card (scaled down).
// The PNG export lives at /api/og/votecard?vote=<id>.
export default async function VoteCardPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDB()

  const [voteRes, bdRes] = await Promise.all([
    db.from('votes').select('*, laws(*)').eq('id', id).maybeSingle(),
    db.from('party_vote_breakdown').select('party_abbr, vote_choice, count').eq('vote_id', id),
  ])
  if (!voteRes.data) notFound()

  const data = mapVoteToCard(voteRes.data, bdRes.data ?? [])

  return (
    <>
      {/* Card fonts for the browser preview (the PNG route loads them server-side). */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap"
      />
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>Previzualizare 1080×1080</span>
          <a href={`/api/og/votecard?vote=${id}`} target="_blank" rel="noopener noreferrer" className="text-foreground underline">
            Deschide PNG →
          </a>
        </div>
        <div style={{ width: 1080 * 0.62, height: 1080 * 0.62, overflow: 'hidden', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
          <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left' }}>
            <VoteCard data={data} />
          </div>
        </div>
      </div>
    </>
  )
}
