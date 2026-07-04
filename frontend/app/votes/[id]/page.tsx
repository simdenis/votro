import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, choiceLabel, choiceColor, countNoun } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { PartyBadge } from '@/components/party-badge'
import { PartyBreakdown } from '@/components/party-breakdown'
import { SeatArc } from '@/components/seat-arc'
import { ShareButtons } from '@/components/share-buttons'
import { CardDownload } from '@/components/card-download'
import { voteSourceUrl } from '@/lib/types'
import type { VoteWithLaw, PoliticianVoteWithDetails, PartyVoteBreakdown } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://votro.ro'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const db = getDB()
  const { data } = await db.from('votes').select('*, laws(*)').eq('id', id).maybeSingle()
  const vote = data as VoteWithLaw | null
  if (!vote) return { title: 'Vot' }

  const code    = vote.laws?.code ?? 'Vot de plen'
  const title   = vote.laws?.title ?? vote.description ?? 'Vot fără lege asociată'
  const short   = title.length > 60 ? title.slice(0, 60) + '…' : title
  const outcome = vote.outcome === 'adoptat' ? 'adoptat' : vote.outcome === 'respins' ? 'respins' : null
  const desc    = [
    `${vote.laws?.code ? `Proiectul ${vote.laws.code}` : 'Votul'}${outcome ? ` a fost ${outcome}` : ''} pe ${formatDate(vote.vote_date)}.`,
    `${vote.for_count ?? 0} pentru, ${vote.against_count ?? 0} împotrivă, ${vote.abstention_count ?? 0} abțineri.`,
  ].join(' ')
  const ogImage = `${SITE_URL}/api/og/vote?id=${id}`

  return {
    title: `${code} — ${short}`,
    description: desc,
    openGraph: { title: `${code} — ${short}`, description: desc, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter:    { card: 'summary_large_image', title: `${code} — ${short}`, description: desc, images: [ogImage] },
  }
}

export default async function VoteDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = getDB()

  const [r0, r1, r2] = await Promise.all([
    db.from('votes').select('*, laws(*)').eq('id', id).maybeSingle(),
    db
      .from('politician_votes')
      .select('*, politicians!inner(*, parties!inner(*))')
      .eq('vote_id', id)
      .order('vote_choice'),
    db.from('party_vote_breakdown').select('*').eq('vote_id', id),
  ])

  const vote         = r0.data as VoteWithLaw | null
  const senatorVotes = r1.data as PoliticianVoteWithDetails[] | null
  const breakdown    = r2.data as PartyVoteBreakdown[] | null

  if (!vote) notFound()

  // True absentees: chamber seats − everyone counted on the vote page.
  // Distinct from not_voted_count (present, but didn't press a button).
  const { count: seats } = await db
    .from('politicians')
    .select('id', { count: 'exact', head: true })
    .eq('chamber', vote.chamber)
  const participants = (vote.for_count ?? 0) + (vote.against_count ?? 0)
    + (vote.abstention_count ?? 0) + (vote.not_voted_count ?? 0)
  const absentCount = seats ? Math.max(0, seats - participants) : null

  const adopted       = vote.outcome === 'adoptat'
  const heroColor     = adopted ? 'var(--color-for)' : vote.outcome === 'respins' ? 'var(--color-against)' : 'var(--muted)'
  const deviatorCount = senatorVotes?.filter(sv => sv.party_line_deviation).length ?? 0
  const sourceUrl     = voteSourceUrl(vote)
  const isDep         = vote.chamber === 'deputies'
  const memberPath    = isDep ? '/deputies' : '/senators'
  const memberNoun    = (n: number) =>
    isDep ? countNoun(n, 'deputat', 'deputați') : countNoun(n, 'senator', 'senatori')

  const indSenators =
    senatorVotes
      ?.filter(sv => sv.politicians.parties.abbreviation === 'IND')
      .map(sv => ({
        politician_id: sv.politician_id,
        name: sv.politicians.name,
        first_name: sv.politicians.first_name,
        vote_choice: sv.vote_choice,
      })) ?? []

  return (
    <div className="space-y-6">

      {/* ── Outcome hero banner ─────────────────────────── */}
      <div className="bg-surface" style={{ borderLeft: `3px solid ${heroColor}`, paddingLeft: 16 }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted mb-3">
          <Link href="/votes" className="hover:text-foreground transition-colors">Voturi</Link>
          <span className="text-faint">›</span>
          {vote.law_id && vote.laws ? (
            <Link href={`/legi/${vote.law_id}`} className="hover:text-foreground transition-colors font-semibold">
              {vote.laws.code}
            </Link>
          ) : (
            <span className="font-semibold">Vot de plen</span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {vote.outcome && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={heroColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  {adopted ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
                </svg>
              )}
              <span className="font-mono text-xs font-bold" style={{ color: heroColor }}>
                {vote.laws?.code ?? 'Vot de plen'}
              </span>
              {vote.laws?.law_category && (
                <span className="text-[11px] bg-raised text-faint rounded-[3px] px-1.5 py-px">
                  {vote.laws.law_category}
                </span>
              )}
              <span className="text-xs text-muted">{formatDate(vote.vote_date)}</span>
            </div>
            <h1 className="font-serif text-[26px] font-normal text-foreground leading-[1.1]">{vote.laws?.title ?? vote.description ?? 'Vot fără lege asociată'}</h1>
          </div>

          {/* Vote counts */}
          <div className="flex gap-5 flex-shrink-0">
            {[
              { label: 'Pentru',    value: vote.for_count,        color: 'var(--color-for)' },
              { label: 'Împotrivă', value: vote.against_count,    color: 'var(--color-against)' },
              { label: 'Abțineri',  value: vote.abstention_count, color: 'var(--color-abstention)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color }}>
                  {value ?? '—'}
                </div>
                <div className="text-[10px] text-muted uppercase tracking-widest mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Share row + official source */}
        <div className="mt-3 pt-3 border-t border-rim/50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <ShareButtons
              url={`${SITE_URL}/votes/${vote.id}`}
              tweet={`${vote.laws?.code ?? 'Vot de plen'} — ${(vote.laws?.title ?? vote.description ?? 'vot fără lege asociată').slice(0, 80)}. ${vote.outcome === 'adoptat' ? 'Adoptat' : vote.outcome === 'respins' ? 'Respins' : ''} cu ${vote.for_count ?? 0} pentru și ${vote.against_count ?? 0} împotrivă. ${SITE_URL}/votes/${vote.id}`}
            />
            <CardDownload href={`/api/og/votecard?vote=${vote.id}`} filename={`votro-${(vote.laws?.code ?? 'vot').replace(/[^\w]+/g, '-')}.png`} />
            {deviatorCount > 0 && (
              <CardDownload
                href={`/api/og/deviationcard?vote=${vote.id}`}
                filename={`votro-devieri-${(vote.laws?.code ?? 'vot').replace(/[^\w]+/g, '-')}.png`}
                label="Card devieri"
              />
            )}
          </div>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors whitespace-nowrap"
            >
              Sursă oficială: {vote.chamber === 'deputies' ? 'cdep.ro' : 'senat.ro'} →
            </a>
          )}
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-5 items-start">

        {/* Left: seat arc + senator table */}
        <div className="space-y-5">

          {/* Seat arc */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
              Distribuție în plen — {vote.present_count ?? '—'} {memberNoun(vote.present_count ?? 2)} prezenți
            </h2>
            <div className="bg-surface border border-rim rounded-xl p-4 flex flex-col items-center">
              <SeatArc
                forCount={vote.for_count ?? 0}
                againstCount={vote.against_count ?? 0}
                abstentionCount={vote.abstention_count ?? 0}
                notVotedCount={vote.not_voted_count ?? 0}
                outcome={vote.outcome}
              />
              <div className="flex gap-4 mt-3 flex-wrap justify-center">
                {[
                  { color: 'var(--color-for)',        label: 'Pentru',    value: vote.for_count },
                  { color: 'var(--color-against)',    label: 'Împotrivă', value: vote.against_count },
                  { color: 'var(--color-abstention)', label: 'Abțineri',  value: vote.abstention_count },
                  // grey dots in the arc — present but didn't press a button
                  ...((vote.not_voted_count ?? 0) > 0
                    ? [{ color: '#d1d5db', label: 'Prezenți, nu au votat', value: vote.not_voted_count }]
                    : []),
                  ...(absentCount
                    ? [{ color: '#efeee9', label: 'Absenți', value: absentCount }]
                    : []),
                ].map(({ color, label, value }) => (
                  <span key={label} className="flex items-center gap-1.5 text-sm text-muted">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {label}
                    <strong className="text-foreground tabular-nums">{value ?? '—'}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Individual senator votes */}
          {senatorVotes && senatorVotes.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                Voturi individuale
              </h2>
              {deviatorCount > 0 && (
                <p className="text-sm text-muted mb-3">
                  <span className="text-deviere font-semibold">
                    {deviatorCount} {memberNoun(deviatorCount)}
                  </span>{' '}
                  {deviatorCount === 1 ? 'a votat' : 'au votat'} împotriva liniei de partid.
                </p>
              )}
              <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
                {senatorVotes.map(sv => (
                  <Link
                    key={sv.id}
                    href={`${memberPath}/${sv.politician_id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors"
                    style={sv.party_line_deviation ? { borderLeft: '2px solid var(--color-deviation)' } : undefined}
                  >
                    <span className="text-sm text-foreground font-medium flex-1 flex items-center gap-1.5">
                      {sv.politicians.first_name} {sv.politicians.name}
                      {sv.party_line_deviation && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-deviere font-bold bg-deviere/10 px-1.5 py-px rounded-[3px]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                          deviere
                        </span>
                      )}
                    </span>
                    {/* noLink: this badge sits inside the row <Link>; nested <a> breaks hydration */}
                    <PartyBadge
                      abbreviation={sv.politicians.parties.abbreviation}
                      color={sv.politicians.parties.color}
                      noLink
                    />
                    <span
                      className="text-sm font-bold w-20 text-right tabular-nums"
                      style={{ color: choiceColor(sv.vote_choice) }}
                    >
                      {choiceLabel(sv.vote_choice)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: party stance cards */}
        {(breakdown?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
              Poziție partide
            </h2>
            <PartyBreakdown rows={breakdown!} indSenators={indSenators} />
          </div>
        )}
      </div>
    </div>
  )
}
