import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { MiniVoteBar } from '@/components/mini-vote-bar'
import type { LawStatus } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const db = getDB()
  const { data } = await db.from('law_status').select('code, title').eq('law_id', id).maybeSingle()
  if (!data) return { title: 'Lege' }
  return { title: `${data.code} — ${(data.title ?? '').slice(0, 60)}` }
}

export default async function LawDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDB()

  const { data } = await db.from('law_status').select('*').eq('law_id', id).maybeSingle()
  const law = data as LawStatus | null
  if (!law) notFound()

  return (
    <div className="space-y-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/legi" className="hover:text-foreground transition-colors">Legi</Link>
        <span className="text-faint">›</span>
        <span className="font-semibold text-foreground font-mono">{law.code}</span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-muted">{law.code}</span>
          {law.law_category && (
            <span className="text-[10px] bg-raised border border-rim text-muted rounded px-1.5 py-px">
              {law.law_category}
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-foreground leading-snug">{law.title}</h1>
      </div>

      {/* Chamber cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChamberCard
          chamber="Senat"
          voteId={law.senate_vote_id}
          date={law.senate_vote_date}
          outcome={law.senate_outcome}
          forCount={law.senate_for}
          againstCount={law.senate_against}
          abstentionCount={law.senate_abstentions}
        />
        <ChamberCard
          chamber="Camera Deputaților"
          voteId={law.camera_vote_id}
          date={law.camera_vote_date}
          outcome={law.camera_outcome}
          forCount={law.camera_for}
          againstCount={law.camera_against}
          abstentionCount={law.camera_abstentions}
        />
      </div>
    </div>
  )
}

function ChamberCard({
  chamber, voteId, date, outcome, forCount, againstCount, abstentionCount,
}: {
  chamber: string
  voteId: string | null
  date: string | null
  outcome: 'adoptat' | 'respins' | null
  forCount: number | null
  againstCount: number | null
  abstentionCount: number | null
}) {
  const voted = !!voteId

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${
      voted
        ? outcome === 'adoptat' ? 'border-adoptat/40 bg-surface'
        : outcome === 'respins' ? 'border-respins/40 bg-surface'
        : 'border-rim bg-surface'
        : 'border-dashed border-rim bg-raised/50'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">{chamber}</span>
        {voted ? (
          <OutcomeBadge outcome={outcome} />
        ) : (
          <span className="text-xs text-faint italic">Nesupus la vot</span>
        )}
      </div>

      {voted ? (
        <>
          {date && (
            <p className="text-xs text-muted">{formatDate(date)}</p>
          )}

          <div className="flex gap-6">
            {[
              { label: 'Pentru',    value: forCount,         color: '#22c55e' },
              { label: 'Împotrivă', value: againstCount,     color: '#ef4444' },
              { label: 'Abțineri',  value: abstentionCount,  color: '#8888cc' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color }}>
                  {value ?? '—'}
                </div>
                <div className="text-[10px] text-muted uppercase tracking-widest mt-1">{label}</div>
              </div>
            ))}
          </div>

          <MiniVoteBar
            forCount={forCount}
            againstCount={againstCount}
            abstentionCount={abstentionCount}
          />

          <Link
            href={`/votes/${voteId}`}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Vezi vot complet →
          </Link>
        </>
      ) : (
        <p className="text-sm text-faint">
          Această cameră nu a votat încă acest proiect de lege.
        </p>
      )}
    </div>
  )
}
