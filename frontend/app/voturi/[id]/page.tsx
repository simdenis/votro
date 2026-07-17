import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, choiceLabel, choiceColor, countNoun, capFirst, lawSlug , personSlug, CHAMBER_SEATS } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { PartyBadge } from '@/components/party-badge'
import { AiSummary } from '@/components/ai-summary'
import { PartyBreakdown } from '@/components/party-breakdown'
import { SeatArc } from '@/components/seat-arc'
import { ShareButtons } from '@/components/share-buttons'
import { HoverNames, type HoverPerson } from '@/components/hover-names'
import { CardDownload } from '@/components/card-download'
import { voteSourceUrl } from '@/lib/types'
import type { VoteWithLaw, PoliticianVoteWithDetails, PartyVoteBreakdown } from '@/lib/types'

export const revalidate = 600 // ISR — CDN-cache per vote for 10 min (see homepage note)

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://la-butoane.ro'

// cache(): generateMetadata and the page both need the vote — one query per render
const getVote = cache(async (id: string): Promise<VoteWithLaw | null> => {
  const { data } = await getDB().from('votes').select('*, laws(*)').eq('id', id).maybeSingle()
  return data as VoteWithLaw | null
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const vote = await getVote(id)
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

  const [vote, r1, r2] = await Promise.all([
    getVote(id),
    db
      .from('politician_votes')
      .select('id, politician_id, vote_choice, party_line_deviation, politicians!inner(first_name, name, parties!inner(abbreviation, color))')
      .eq('vote_id', id)
      .order('vote_choice'),
    db.from('party_vote_breakdown').select('*').eq('vote_id', id),
  ])

  const senatorVotes = r1.data as unknown as PoliticianVoteWithDetails[] | null
  const breakdown    = r2.data as PartyVoteBreakdown[] | null

  if (!vote) notFound()

  // Active roster of the vote's chamber — one query supplies both the occupied
  // seat count (tracks vacancies the nominal totals miss) and the names for the
  // synthetic absents below. Sanity floor: a broken/short roster must not zero
  // out absentees, so fall back to the nominal seat totals.
  const { data: rosterData } = await db
    .from('politicians')
    .select('id, name, first_name, parties!inner(abbreviation, color)')
    .eq('chamber', vote.chamber)
    .eq('active', true)
  const roster = (rosterData ?? []) as any[]
  const seats = roster.length > 100 ? roster.length : CHAMBER_SEATS[vote.chamber]

  // True absentees: official chamber seats − everyone counted here (distinct
  // from not_voted_count = present but didn't press a button). Joint sessions
  // (Chamber + Senate together) have more participants than one chamber's
  // seats — there the single-chamber absentee framing is meaningless, so hide it.
  const participants = (vote.for_count ?? 0) + (vote.against_count ?? 0)
    + (vote.abstention_count ?? 0) + (vote.not_voted_count ?? 0)
  const jointSession = participants > seats
  const absentCount = jointSession ? null : Math.max(0, seats - participants)

  // The source only names *some* absentees individually (a roll call rarely lists
  // every empty seat). Fill the gap: any active member of this chamber with no
  // recorded vote is shown as "Absent", so the list matches the count above.
  const CHOICE_ORDER: Record<string, number> = { for: 0, against: 1, abstention: 2, not_voted: 3, absent: 4 }
  let individualVotes = senatorVotes ?? []
  if (!jointSession && individualVotes.length > 0) {
    const recorded = new Set(individualVotes.map(sv => sv.politician_id))
    const synthetic = roster
      .filter(p => !recorded.has(p.id))
      .map(p => ({
        id: `absent-${p.id}`,
        politician_id: p.id,
        party_line_deviation: false,
        vote_choice: 'absent',
        politicians: { name: p.name, first_name: p.first_name, parties: p.parties },
      })) as PoliticianVoteWithDetails[]
    individualVotes = [...individualVotes, ...synthetic]
      .sort((a, b) => (CHOICE_ORDER[a.vote_choice] ?? 9) - (CHOICE_ORDER[b.vote_choice] ?? 9))
  }

  const adopted       = vote.outcome === 'adoptat'
  const heroColor     = adopted ? 'var(--color-for)' : vote.outcome === 'respins' ? 'var(--color-against)' : 'var(--muted)'
  const deviatorCount = senatorVotes?.filter(sv => sv.party_line_deviation).length ?? 0
  const sourceUrl     = voteSourceUrl(vote)
  const isDep         = vote.chamber === 'deputies'
  const memberPath    = isDep ? '/deputati' : '/senatori'
  const memberNoun    = (n: number) =>
    isDep ? countNoun(n, 'deputat', 'deputați') : countNoun(n, 'senator', 'senatori')

  const person = (sv: PoliticianVoteWithDetails): HoverPerson => ({
    name: `${sv.politicians.first_name} ${sv.politicians.name}`.trim(),
    color: sv.politicians.parties.color,
    party: sv.politicians.parties.abbreviation,
  })
  const deviatorPeople = senatorVotes?.filter(sv => sv.party_line_deviation).map(person) ?? []
  // party -> vote_choice -> people, for hoverable numbers in the breakdown
  const voters: Record<string, Record<string, HoverPerson[]>> = {}
  for (const sv of senatorVotes ?? []) {
    const party = sv.politicians.parties.abbreviation
    ;((voters[party] ??= {})[sv.vote_choice] ??= []).push(person(sv))
  }

  // party_vote_breakdown only counts recorded votes, so absentees per party
  // read as ~0. Where we synthesized the full roster (single chamber), rebuild
  // the breakdown from individualVotes so absents are attributed per party.
  let breakdownRows = breakdown ?? []
  if (!jointSession && individualVotes.length > 0) {
    const acc = new Map<string, { color: string; ch: Record<string, number> }>()
    for (const sv of individualVotes) {
      const abbr = sv.politicians.parties.abbreviation
      const e = acc.get(abbr) ?? acc.set(abbr, { color: sv.politicians.parties.color, ch: {} }).get(abbr)!
      e.ch[sv.vote_choice] = (e.ch[sv.vote_choice] ?? 0) + 1
    }
    breakdownRows = [...acc].flatMap(([abbr, { color, ch }]) =>
      Object.entries(ch).map(([choice, count]) => ({
        vote_id: id, party_id: abbr, party_name: abbr, party_abbr: abbr,
        party_color: color, vote_choice: choice as PartyVoteBreakdown['vote_choice'], count,
      })),
    )
  }


  return (
    <div className="space-y-6">

      {/* ── Outcome hero banner ─────────────────────────── */}
      <div className="bg-surface" style={{ borderLeft: `3px solid ${heroColor}`, paddingLeft: 16 }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted mb-3">
          <Link href="/voturi" className="hover:text-foreground transition-colors">Voturi</Link>
          <span className="text-faint">›</span>
          {vote.law_id && vote.laws ? (
            <Link href={`/legi/${lawSlug(vote.laws.code)}`} className="hover:text-foreground transition-colors font-semibold">
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
            <h1 className="font-serif text-[26px] font-normal text-foreground leading-[1.1]">{capFirst(vote.laws?.title ?? vote.description ?? '') || 'Vot fără lege asociată'}</h1>
          </div>

          {/* Vote counts — boxed full-width row on small screens so long
              titles and the numbers never crowd or clip each other */}
          <div className="flex gap-4 sm:gap-6 justify-between sm:justify-start w-full xl:w-auto xl:flex-shrink-0 border border-rim bg-raised/40 rounded-lg px-4 py-3 xl:border-0 xl:bg-transparent xl:p-0">
            {[
              { label: 'Pentru',    value: vote.for_count ?? 0,        color: 'var(--color-for)' },
              { label: 'Împotrivă', value: vote.against_count ?? 0,    color: 'var(--color-against)' },
              { label: 'Abțineri',  value: vote.abstention_count ?? 0, color: 'var(--color-abstention)' },
              // Absentees: seats − present. null on joint sessions (both chambers).
              { label: 'Absenți',   value: absentCount,           color: 'var(--muted)' },
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
              url={`${SITE_URL}/voturi/${vote.id}`}
              tweet={`${vote.laws?.code ?? 'Vot de plen'} — ${(vote.laws?.title ?? vote.description ?? 'vot fără lege asociată').slice(0, 80)}. ${vote.outcome === 'adoptat' ? 'Adoptat' : vote.outcome === 'respins' ? 'Respins' : ''} cu ${vote.for_count ?? 0} pentru și ${vote.against_count ?? 0} împotrivă. ${SITE_URL}/voturi/${vote.id}`}
            />
            {deviatorCount > 0 && (
              <CardDownload
                href={`/api/og/deviationcard?vote=${vote.id}`}
                filename={`labutoane-devieri-${(vote.laws?.code ?? 'vot').replace(/[^\w]+/g, '-')}.png`}
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

      {/* ── AI law summary (same box as the law page) ────── */}
      {vote.laws?.summary && (
        <AiSummary summary={vote.laws.summary} isAi={vote.laws.summary_is_ai} emUrl={vote.laws.em_url} code={vote.laws.code} />
      )}

      {/* ── Two-column body ───────────────────────────────
          DOM order = mobile order: arc → party stances → individuals.
          On xl the party column moves right, spanning both rows. */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-5 items-start">

          {/* Seat arc */}
          <div className="xl:col-start-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
              Distribuție în plen — {vote.present_count ?? '—'} {memberNoun(vote.present_count ?? 2)} prezenți
            </h2>
            <div className="bg-surface border border-rim rounded-xl p-4 flex flex-col items-center">
              <SeatArc
                forCount={vote.for_count ?? 0}
                againstCount={vote.against_count ?? 0}
                abstentionCount={vote.abstention_count ?? 0}
                notVotedCount={vote.not_voted_count ?? 0}
                absentCount={absentCount ?? 0}
                outcome={vote.outcome}
              />
              <div className="flex gap-4 mt-3 flex-wrap justify-center">
                {[
                  { color: 'var(--color-for)',        label: 'Pentru',    value: vote.for_count ?? 0 },
                  { color: 'var(--color-against)',    label: 'Împotrivă', value: vote.against_count ?? 0 },
                  { color: 'var(--color-abstention)', label: 'Abțineri',  value: vote.abstention_count ?? 0 },
                  // grey dots in the arc — present but didn't press a button
                  ...((vote.not_voted_count ?? 0) > 0
                    ? [{ color: 'var(--muted)', label: 'Prezenți, nu au votat', value: vote.not_voted_count }]
                    : []),
                  ...(absentCount
                    ? [{ color: 'var(--color-absent)', label: 'Absenți', value: absentCount }]
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

        {/* Party stance cards — right column on xl, second on mobile */}
        {breakdownRows.length > 0 && (
          <div className="xl:col-start-2 xl:row-start-1 xl:row-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
              Poziție partide
            </h2>
            <PartyBreakdown rows={breakdownRows} voters={voters} />
          </div>
        )}

          {/* Individual senator votes */}
          {individualVotes.length > 0 && (
            <div className="xl:col-start-1">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                Voturi individuale
              </h2>
              {deviatorCount > 0 && (
                <p className="text-sm text-muted mb-3">
                  <HoverNames people={deviatorPeople} title="Au deviat de la linia de partid">
                    <span className="text-deviere font-semibold">
                      {deviatorCount} {memberNoun(deviatorCount)}
                    </span>
                  </HoverNames>{' '}
                  {deviatorCount === 1 ? 'a votat' : 'au votat'} împotriva liniei de partid.
                </p>
              )}
              <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
                {individualVotes.map(sv => (
                  <Link
                    key={sv.id}
                    href={`${memberPath}/${personSlug(sv.politicians.first_name, sv.politicians.name)}`}
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
    </div>
  )
}
