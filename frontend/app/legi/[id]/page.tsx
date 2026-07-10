import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, capFirst } from '@/lib/utils'
import { activeSeats } from '@/lib/seats'
import { OutcomeBadge } from '@/components/outcome-badge'
import { PartyBreakdown } from '@/components/party-breakdown'
import { SeatArc } from '@/components/seat-arc'
import { LawTimeline } from '@/components/law-timeline'
import { BaseLawBadges } from '@/components/base-law-badge'
import { CardDownload } from '@/components/card-download'
import type { LawStatus, PartyVoteBreakdown } from '@/lib/types'

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

  // Absentees per chamber: official seats − present. Joint sessions (present >
  // one chamber's seats) return null — the single-chamber framing doesn't apply.
  async function absentFor(voteId: string | null, chamber: 'senate' | 'deputies') {
    if (!voteId) return null
    const { data } = await db
      .from('votes')
      .select('present_count, for_count, against_count, abstention_count, not_voted_count')
      .eq('id', voteId)
      .maybeSingle()
    if (!data) return null
    const seats = await activeSeats(chamber)
    const present = data.present_count
      ?? (data.for_count ?? 0) + (data.against_count ?? 0) + (data.abstention_count ?? 0) + (data.not_voted_count ?? 0)
    return present > seats ? null : Math.max(0, seats - present)
  }

  // Fetch party breakdowns + absentees for both chambers in parallel
  const [senateBreakdown, cameraBreakdown, senateAbsent, cameraAbsent] = await Promise.all([
    law.senate_vote_id
      ? db.from('party_vote_breakdown').select('*').eq('vote_id', law.senate_vote_id).then(r => r.data as PartyVoteBreakdown[] | null)
      : Promise.resolve(null),
    law.camera_vote_id
      ? db.from('party_vote_breakdown').select('*').eq('vote_id', law.camera_vote_id).then(r => r.data as PartyVoteBreakdown[] | null)
      : Promise.resolve(null),
    absentFor(law.senate_vote_id, 'senate'),
    absentFor(law.camera_vote_id, 'deputies'),
  ])

  return (
    <div className="space-y-10">

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
          <BaseLawBadges title={law.title} />
        </div>
        <h1 className="font-serif text-[30px] font-normal text-foreground leading-[1.12] tracking-[-0.01em]">{capFirst(law.title)}</h1>

        {law.summary && (
          <div className="relative mt-5 bg-surface border border-rim rounded-xl p-5 pl-6 overflow-hidden">
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-sidebar" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Pe scurt</p>
            <p className="text-[15px] text-foreground leading-relaxed">{law.summary}</p>
            <div className="mt-3.5 pt-3 border-t border-rim flex items-center justify-between gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-faint">
              {law.summary_is_ai && <span>Rezumat generat automat</span>}
              {law.em_url && (
                <a href={law.em_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-2">
                  Sursa: expunerea de motive (PDF)
                </a>
              )}
            </div>
          </div>
        )}

        {law.em_url && !law.summary && (
          <a
            href={law.em_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-sm text-muted hover:text-foreground transition-colors"
          >
            Citește expunerea de motive (PDF) →
          </a>
        )}
        <div className="mt-4 flex gap-2 flex-wrap">
          <CardDownload href={`/api/og/lawcard?id=${law.law_id}`} filename={`labutoane-${law.code.replace(/[^\w]+/g, '-')}.png`} />
          {law.summary && (
            <CardDownload
              href={`/api/og/summarycard?id=${law.law_id}`}
              filename={`labutoane-pescurt-${law.code.replace(/[^\w]+/g, '-')}.png`}
              label="Card rezumat"
            />
          )}
          {/* One card per chamber that actually voted (IG carousel slides). A
              chamber the law passed WITHOUT a plenary vote gets the tacit
              card instead — "nimeni nu a votat". */}
          {law.senate_vote_id ? (
            <CardDownload
              href={`/api/og/lawcard?id=${law.law_id}&chamber=senate`}
              filename={`labutoane-${law.code.replace(/[^\w]+/g, '-')}-senat.png`}
              label="Card Senat"
            />
          ) : law.presidential_status ? (
            <CardDownload
              href={`/api/og/tacitcard?id=${law.law_id}&chamber=senate`}
              filename={`labutoane-${law.code.replace(/[^\w]+/g, '-')}-tacit-senat.png`}
              label="Card tacit — Senat"
            />
          ) : null}
          {law.camera_vote_id ? (
            <CardDownload
              href={`/api/og/lawcard?id=${law.law_id}&chamber=camera`}
              filename={`labutoane-${law.code.replace(/[^\w]+/g, '-')}-camera.png`}
              label="Card Cameră"
            />
          ) : law.presidential_status ? (
            <CardDownload
              href={`/api/og/tacitcard?id=${law.law_id}&chamber=camera`}
              filename={`labutoane-${law.code.replace(/[^\w]+/g, '-')}-tacit-camera.png`}
              label="Card tacit — Cameră"
            />
          ) : null}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-surface border border-rim rounded-xl p-5">
        <LawTimeline law={law} />
      </div>

      {/* Chamber sections */}
      <ChamberSection
        chamber="Senat"
        voteId={law.senate_vote_id}
        date={law.senate_vote_date}
        outcome={law.senate_outcome}
        forCount={law.senate_for}
        againstCount={law.senate_against}
        abstentionCount={law.senate_abstentions}
        breakdown={senateBreakdown}
        absentCount={senateAbsent}
        passed={!!law.presidential_status}
      />

      <ChamberSection
        chamber="Camera Deputaților"
        voteId={law.camera_vote_id}
        date={law.camera_vote_date}
        outcome={law.camera_outcome}
        forCount={law.camera_for}
        againstCount={law.camera_against}
        abstentionCount={law.camera_abstentions}
        breakdown={cameraBreakdown}
        absentCount={cameraAbsent}
        passed={!!law.presidential_status}
      />
    </div>
  )
}

function ChamberSection({
  chamber, voteId, date, outcome, forCount, againstCount, abstentionCount, breakdown, passed, absentCount,
}: {
  chamber: string
  voteId: string | null
  date: string | null
  outcome: 'adoptat' | 'respins' | null
  forCount: number | null
  againstCount: number | null
  abstentionCount: number | null
  breakdown: PartyVoteBreakdown[] | null
  passed: boolean
  absentCount: number | null
}) {
  const borderColor =
    outcome === 'adoptat' ? 'border-adoptat/30' :
    outcome === 'respins' ? 'border-respins/30' :
    'border-rim'

  return (
    <div className={`rounded-xl border ${voteId ? borderColor : 'border-dashed border-rim'} overflow-hidden`}>
      {/* Chamber header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-rim bg-raised/50">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">{chamber}</span>
        {voteId
          ? <OutcomeBadge outcome={outcome} />
          : passed
            ? <span className="text-xs text-adoptat/80 italic">Adoptată — fără vot în plen</span>
            : <span className="text-xs text-faint italic">Nesupus la vot</span>}
      </div>

      {!voteId ? (
        <p className="px-5 py-6 text-sm text-faint">
          {passed
            ? 'Adoptată fără vot în plen înregistrat (adoptare tacită, sau votul nu este încă în baza de date). Legea a parcurs ambele camere — vezi statutul prezidențial.'
            : 'Această cameră nu a votat încă acest proiect de lege.'}
        </p>
      ) : (
        <div className="p-5 space-y-6">
          {/* Date + counts */}
          <div className="flex items-end gap-8 flex-wrap">
            {date && <p className="text-xs text-muted">{formatDate(date)}</p>}
            <div className="flex gap-6">
              {[
                { label: 'Pentru',    value: forCount,         color: 'var(--color-for)' },
                { label: 'Împotrivă', value: againstCount,     color: 'var(--color-against)' },
                { label: 'Abțineri',  value: abstentionCount,  color: 'var(--color-abstention)' },
                { label: 'Absenți',   value: absentCount,      color: 'var(--faint)' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color }}>
                    {value ?? '—'}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-widest mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SeatArc + PartyBreakdown */}
          {(breakdown?.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6 items-start">
              <div className="flex flex-col items-center">
                <SeatArc
                  forCount={forCount ?? 0}
                  againstCount={againstCount ?? 0}
                  abstentionCount={abstentionCount ?? 0}
                  notVotedCount={0}
                  outcome={outcome}
                />
                <div className="flex gap-5 mt-2">
                  {[
                    { color: 'var(--color-for)', label: 'Pentru',    value: forCount },
                    { color: 'var(--color-against)', label: 'Împotrivă', value: againstCount },
                    { color: 'var(--color-abstention)', label: 'Abțineri',  value: abstentionCount },
                  ].map(({ color, label, value }) => (
                    <span key={label} className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      {label}
                      <strong className="text-foreground tabular-nums">{value ?? '—'}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Poziție partide</p>
                <PartyBreakdown rows={breakdown!} />
              </div>
            </div>
          )}

          <Link
            href={`/votes/${voteId}`}
            className="inline-flex text-xs text-muted hover:text-foreground transition-colors"
          >
            Vezi voturi individuale →
          </Link>
        </div>
      )}
    </div>
  )
}
