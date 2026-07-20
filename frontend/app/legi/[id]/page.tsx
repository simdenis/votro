import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, capFirst, isUuid, lawSlug, slugToCode } from '@/lib/utils'
import { activeSeats } from '@/lib/seats'
import { OutcomeBadge } from '@/components/outcome-badge'
import { PartyBreakdown } from '@/components/party-breakdown'
import { AiSummary } from '@/components/ai-summary'
import { SeatArc } from '@/components/seat-arc'
import { LawTimeline } from '@/components/law-timeline'
import { BaseLawBadges } from '@/components/base-law-badge'
import { CategoryBadge } from '@/components/category-badge'
import { ReportMistake } from '@/components/report-mistake'
import type { LawStatus, PartyVoteBreakdown } from '@/lib/types'

export const revalidate = 3600

// A law is addressed by its code slug (/legi/L597-2025); UUIDs still resolve
// (old shared/indexed links) and get redirected to the canonical slug.
// cache(): generateMetadata and the page share one query per render.
const getLaw = cache(async (id: string): Promise<LawStatus | null> => {
  const q = getDB().from('law_status').select('*')
  const { data } = await (isUuid(id) ? q.eq('law_id', id) : q.eq('code', slugToCode(id))).maybeSingle()
  return data as LawStatus | null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const law = await getLaw(id)
  if (!law) return { title: 'Lege' }
  return {
    title: `${law.code} — ${(law.title ?? '').slice(0, 60)}`,
    alternates: { canonical: `/legi/${lawSlug(law.code)}` },
  }
}

export default async function LawDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDB()

  const law = await getLaw(id)
  if (!law) notFound()
  // UUID / wrong-case URLs still serve the page; the canonical tag (in
  // generateMetadata) points search engines at the code-slug URL.

  // Absentees per chamber: official seats − present. Joint sessions (present >
  // one chamber's seats) return null — the single-chamber framing doesn't apply.
  // notVoted rides along so the seat arc can draw the full chamber exactly like
  // the vote page: voters → present-not-voting (darker grey) → absent (light).
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
    return {
      absent: present > seats ? null : Math.max(0, seats - present),
      notVoted: data.not_voted_count ?? 0,
    }
  }

  // Fetch party breakdowns + absentees for both chambers in parallel
  const [senateBreakdown, cameraBreakdown, senateAbsent, cameraAbsent, lawRow, initiators] = await Promise.all([
    law.senate_vote_id
      ? db.from('party_vote_breakdown').select('*').eq('vote_id', law.senate_vote_id).then(r => r.data as PartyVoteBreakdown[] | null)
      : Promise.resolve(null),
    law.camera_vote_id
      ? db.from('party_vote_breakdown').select('*').eq('vote_id', law.camera_vote_id).then(r => r.data as PartyVoteBreakdown[] | null)
      : Promise.resolve(null),
    absentFor(law.senate_vote_id, 'senate'),
    absentFor(law.camera_vote_id, 'deputies'),
    // law.law_id, NOT the route param — the param is usually a code slug
    // (L99-2026) and uuid columns reject it, silently hiding the initiators.
    db.from('laws').select('initiator_type').eq('id', law.law_id).maybeSingle().then(r => r.data as { initiator_type: string | null } | null),
    db.from('law_initiators')
      .select('name_raw, party_raw, role_raw, politician_id, politicians(chamber)')
      .eq('law_id', law.law_id)
      .order('name_raw')
      .then(r => (r.data ?? []) as unknown as { name_raw: string; party_raw: string | null; role_raw: string | null; politician_id: string | null; politicians: { chamber: string } | null }[]),
  ])
  const initiatorType = lawRow?.initiator_type ?? null

  const lawLd = {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: capFirst(law.title),
    legislationIdentifier: law.code,
    inLanguage: 'ro',
    ...(law.summary ? { abstract: law.summary } : {}),
    legislationPassedBy: { '@type': 'Organization', name: 'Parlamentul României' },
  }

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(lawLd) }} />

      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Link href="/legi" className="hover:text-foreground transition-colors">Legi</Link>
          <span className="text-faint">›</span>
          <span className="font-semibold text-foreground font-mono">{law.code}</span>
        </div>
        <ReportMistake context={{ lege: law.code, pagina: '/legi/' + law.law_id }} />
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-muted">{law.code}</span>
          {law.law_category && <CategoryBadge category={law.law_category} className="text-[10px]" />}
          <BaseLawBadges title={law.title} />
        </div>
        <h1 className="font-serif text-[30px] font-normal text-foreground leading-[1.12] tracking-[-0.01em]">{capFirst(law.title)}</h1>

        {law.summary && (
          <div className="mt-5">
            <AiSummary summary={law.summary} isAi={law.summary_is_ai} emUrl={law.em_url} code={law.code} />
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

        {/* Who proposed it */}
        {initiatorType === 'guvern' && (
          <p className="mt-4 text-sm text-muted">
            <span className="font-semibold text-foreground">Inițiativă:</span> Guvernul României
          </p>
        )}
        {initiatorType === 'cetateni' && (
          <p className="mt-4 text-sm text-muted">
            <span className="font-semibold text-foreground">Inițiativă:</span> cetățenească
          </p>
        )}
        {initiatorType === 'parlamentari' && initiators.length > 0 && (
          <details className="mt-4 text-sm text-muted group">
            <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-foreground">{`Inițiatori (${initiators.length}):`}</span>{' '}
              {initiators.slice(0, 3).map(i => i.name_raw).join(', ')}
              {initiators.length > 3 && (
                <span className="text-adoptat font-medium group-open:hidden">{` + încă ${initiators.length - 3} ›`}</span>
              )}
            </summary>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {initiators.map(i => {
                const href = i.politician_id
                  ? `/${i.politicians?.chamber === 'deputies' ? 'deputati' : 'senatori'}/${i.politician_id}`
                  : null
                const label = `${i.name_raw}${i.party_raw ? ` (${i.party_raw})` : ''}`
                return href ? (
                  <Link key={i.name_raw} href={href} className="hover:text-foreground underline underline-offset-2 transition-colors">
                    {label}
                  </Link>
                ) : (
                  <span key={i.name_raw}>{label}</span>
                )
              })}
            </div>
          </details>
        )}
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
        absentCount={senateAbsent?.absent ?? null}
        notVotedCount={senateAbsent?.notVoted ?? 0}
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
        absentCount={cameraAbsent?.absent ?? null}
        notVotedCount={cameraAbsent?.notVoted ?? 0}
        passed={!!law.presidential_status}
      />
    </div>
  )
}

function ChamberSection({
  chamber, voteId, date, outcome, forCount, againstCount, abstentionCount, breakdown, passed, absentCount, notVotedCount,
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
  notVotedCount: number
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
                { label: 'Pentru',    value: forCount ?? 0,         color: 'var(--color-for)' },
                { label: 'Împotrivă', value: againstCount ?? 0,     color: 'var(--color-against)' },
                { label: 'Abțineri',  value: abstentionCount ?? 0,  color: 'var(--color-abstention)' },
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
                {/* full chamber, same as the vote page: voters → present-not-
                    voting (darker grey) → absents (light grey) */}
                <SeatArc
                  forCount={forCount ?? 0}
                  againstCount={againstCount ?? 0}
                  abstentionCount={abstentionCount ?? 0}
                  notVotedCount={notVotedCount}
                  absentCount={absentCount ?? 0}
                  outcome={outcome}
                />
                <div className="flex gap-5 mt-2 flex-wrap justify-center">
                  {[
                    { color: 'var(--color-for)', label: 'Pentru',    value: forCount ?? 0 },
                    { color: 'var(--color-against)', label: 'Împotrivă', value: againstCount ?? 0 },
                    { color: 'var(--color-abstention)', label: 'Abțineri',  value: abstentionCount ?? 0 },
                    ...(notVotedCount > 0
                      ? [{ color: 'var(--muted)', label: 'Prezenți, nu au votat', value: notVotedCount }]
                      : []),
                    ...(absentCount
                      ? [{ color: 'var(--color-absent)', label: 'Absenți', value: absentCount }]
                      : []),
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
            href={`/voturi/${voteId}`}
            className="inline-flex text-xs text-muted hover:text-foreground transition-colors"
          >
            Vezi voturi individuale →
          </Link>
        </div>
      )}
    </div>
  )
}
