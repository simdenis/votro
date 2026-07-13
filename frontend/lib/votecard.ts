import { hasPartyLine, loyaltyPct } from './utils'
import type { VoteCardData, PartyVote } from '@/components/cards/vote-card'
import type { SenatorCardData } from '@/components/cards/senator-card'
import type { LawCardData, JourneyStep } from '@/components/cards/law-card'
import { trueAbsent, type PoliticianStats, type LawStatus } from '@/lib/types'
import { formatDate, capFirst } from '@/lib/utils'

interface BreakdownRow { party_abbr: string; vote_choice: string; count: number }

/** Group party_vote_breakdown rows into PartyVote entries, largest group first.
 *  Returns every party — the cards size their rows to fit them all. */
export function toParties(rows: BreakdownRow[]): PartyVote[] {
  const by: Record<string, PartyVote> = {}
  for (const row of rows) {
    const p = (by[row.party_abbr] ??= { name: row.party_abbr, for: 0, against: 0, abstain: 0, absent: 0 })
    const c = row.count ?? 0
    if (row.vote_choice === 'for') p.for += c
    else if (row.vote_choice === 'against') p.against += c
    else if (row.vote_choice === 'abstention') p.abstain += c
    else p.absent += c // not_voted / absent
  }
  return Object.values(by)
    .sort((a, b) => (b.for + b.against + b.abstain + b.absent) - (a.for + a.against + a.abstain + a.absent))
}

/** Map a votes row (with joined laws) + breakdown rows to the VoteCard model.
 *  `seats` = current chamber size; enables true absentees (seats − participants)
 *  and the "X din Y prezenți" line. */
export function mapVoteToCard(vote: any, rows: BreakdownRow[], seats: number | null = null): VoteCardData {
  const isDep = vote.chamber === 'deputies'
  const forC = vote.for_count ?? 0
  const againstC = vote.against_count ?? 0
  const abstainC = vote.abstention_count ?? 0
  const notVoted = vote.not_voted_count ?? 0
  const participants = forC + againstC + abstainC + notVoted
  // Joint sessions (both chambers) have more voters than one chamber's seats —
  // the "X din Y mandate" / absentee framing is meaningless there, so drop seats.
  if (seats != null && participants > seats) seats = null
  return {
    lawCode: vote.laws?.code ?? 'VOT DE PLEN',
    lawTitle: capFirst(vote.laws?.title ?? vote.description ?? '') || 'Vot fără lege asociată',
    chamber: isDep ? 'CAMERĂ' : 'SENAT',
    result: vote.outcome === 'respins' ? 'RESPINS' : 'ADOPTAT',
    year: vote.vote_date ? new Date(vote.vote_date).getFullYear() : 2026,
    dateLabel: vote.vote_date ? formatDate(vote.vote_date) : null,
    votesFor: forC,
    votesAgainst: againstC,
    votesAbstain: abstainC,
    votesNotVoted: notVoted,
    votesAbsent: seats ? Math.max(0, seats - participants) : 0,
    seats,
    source: isDep ? 'cdep.ro' : 'senat.ro',
    parties: toParties(rows),
  }
}

// ── Senator/deputy ──────────────────────────────────────────────────────────
export function mapSenatorToCard(s: PoliticianStats, chamber: 'senate' | 'deputies'): SenatorCardData {
  const noLine = !hasPartyLine(s.party_abbr)
  return {
    fullName: `${s.first_name} ${s.name}`.trim(),
    partyAbbr: s.party_abbr,
    partyColor: s.party_color || '#9e9e9e',
    chamberLabel: chamber === 'deputies' ? 'DEPUTAT' : 'SENATOR',
    year: new Date().getFullYear(),
    // denominator = every plenary vote in the chamber; absents = true absences
    // (recorded 'absent' rows undercount — sources rarely list absentees)
    totalVotes: s.chamber_votes || s.total_votes || 0,
    votesFor: s.votes_for ?? 0,
    votesAgainst: s.votes_against ?? 0,
    votesAbstain: s.votes_abstention ?? 0,
    votesAbsent: trueAbsent(s) ?? s.votes_absent ?? 0,
    // aligned votes over ALL chamber votes — absences lower loyalty (lib/utils)
    loyaltyPct: loyaltyPct(s),
    deviations: s.deviations ?? 0,
    deviationPct: s.deviation_pct != null ? Math.round(s.deviation_pct) : null,
    noLine,
  }
}

// ── Law journey ──────────────────────────────────────────────────────────────
/** The vote whose party breakdown the law card shows: Camera when it voted, else Senat. */
export function lawDecisiveVoteId(law: LawStatus): { voteId: string; chamber: 'camera' | 'senate' } | null {
  if (law.camera_vote_id) return { voteId: law.camera_vote_id, chamber: 'camera' }
  if (law.senate_vote_id) return { voteId: law.senate_vote_id, chamber: 'senate' }
  return null
}

/** True absentees per party: the roster seats a party holds minus the votes it
 *  cast. senat.ro breakdowns only list voters, so the recorded "absent" rows
 *  wildly undercount (a 96-voter Senate vote showed "2 absenți"). Roster
 *  parties that cast no vote at all become full-absent rows. Skipped for joint
 *  sittings (participants > chamber seats). */
export function fillTrueAbsents(parties: PartyVote[], seatsByParty: Record<string, number> | null): PartyVote[] {
  if (!seatsByParty) return parties
  const totalSeats = Object.values(seatsByParty).reduce((a, b) => a + b, 0)
  const participants = parties.reduce((s, p) => s + p.for + p.against + p.abstain + p.absent, 0)
  if (participants > totalSeats) return parties
  const out = parties.map(p => {
    const seats = seatsByParty[p.name]
    if (!seats) return p
    return { ...p, absent: Math.max(p.absent, seats - (p.for + p.against + p.abstain)) }
  })
  for (const [abbr, seats] of Object.entries(seatsByParty)) {
    if (!out.some(p => p.name === abbr)) out.push({ name: abbr, for: 0, against: 0, abstain: 0, absent: seats })
  }
  return out.sort((a, b) => (b.for + b.against + b.abstain + b.absent) - (a.for + a.against + a.abstain + a.absent))
}

/** `forChamber` pins the party-vote section to one chamber (IG carousel slides);
 *  `seatsByParty` (current roster) turns recorded absents into true absents. */
export function mapLawToCard(
  law: LawStatus,
  breakdownRows: BreakdownRow[] = [],
  forChamber: 'camera' | 'senate' | null = null,
  seatsByParty: Record<string, number> | null = null,
): LawCardData {
  const promulgat = law.presidential_status === 'promulgat'
  const senateDone = law.senate_outcome === 'adoptat' || !!law.presidential_status
  const cameraDone = law.camera_outcome === 'adoptat' || !!law.presidential_status
  const rejected = law.senate_outcome === 'respins' || law.camera_outcome === 'respins'

  let statusLabel = 'ÎN DEZBATERE'
  let statusColor = '#171A1F'
  // outcome colors: green = became law / passed, red = failed or bounced
  if (promulgat) { statusLabel = 'PROMULGATĂ'; statusColor = '#1F7A51' }
  // a returned law passed both chambers, but green 'ADOPTATĂ' misleads —
  // the president bounced it back, and that is the story
  else if (law.presidential_status === 'retrimis') { statusLabel = 'RETRIMISĂ LA PARLAMENT'; statusColor = '#C25539' }
  else if (rejected) { statusLabel = 'RESPINSĂ'; statusColor = '#C25539' }
  else if (senateDone && cameraDone) { statusLabel = 'ADOPTATĂ'; statusColor = '#1F7A51' }

  // Chamber slides carry THEIR vote's date; only the unpinned (overview)
  // card shows the promulgation date.
  const chamberVoteDate = forChamber === 'senate' ? law.senate_vote_date
    : forChamber === 'camera' ? law.camera_vote_date
    : null
  const dateLine = forChamber && chamberVoteDate
    ? `Vot în ${forChamber === 'senate' ? 'Senat' : 'Camera Deputaților'} · ${formatDate(chamberVoteDate)}`
    : promulgat && law.presidential_date
      ? `Promulgată · ${formatDate(law.presidential_date)}`
      : cameraDone && law.camera_vote_date
        ? `Adoptată · ${formatDate(law.camera_vote_date)}`
        : null

  const dateForYear = law.presidential_date || law.camera_vote_date || law.senate_vote_date
  const decisive = forChamber
    ? (forChamber === 'camera' && law.camera_vote_id ? { voteId: law.camera_vote_id, chamber: 'camera' as const }
      : forChamber === 'senate' && law.senate_vote_id ? { voteId: law.senate_vote_id, chamber: 'senate' as const }
      : null)
    : lawDecisiveVoteId(law)
  const isCam = decisive?.chamber === 'camera'

  // Journey strip tells the story chronologically across carousel slides: a
  // chamber shows its outcome color only up to the displayed slide's vote —
  // the other chamber's later vote stays gray and gets revealed on its slide.
  const outcomes = {
    senate: (law.senate_outcome as 'adoptat' | 'respins' | null)
      ?? (law.senate_vote_id ? null : law.presidential_status ? 'adoptat' as const : null), // tacit pass
    camera: (law.camera_outcome as 'adoptat' | 'respins' | null)
      ?? (law.camera_vote_id ? null : law.presidential_status ? 'adoptat' as const : null),
  }
  const voteDates = { senate: law.senate_vote_date ?? '', camera: law.camera_vote_date ?? '' }
  const shownDate = decisive ? voteDates[decisive.chamber] : ''
  const step = (ch: 'senate' | 'camera', label: string): JourneyStep => {
    const active = decisive?.chamber === ch
    const revealed = !decisive || active || !voteDates[ch] || voteDates[ch] <= shownDate
    return { label, outcome: revealed ? outcomes[ch] : null, active }
  }
  return {
    lawCode: law.code,
    lawTitle: capFirst(law.title) || '—',
    category: law.law_category ?? null,
    year: dateForYear ? new Date(dateForYear).getFullYear() : new Date().getFullYear(),
    statusLabel,
    statusColor,
    dateLine,
    // just the two chambers — the badge carries the final outcome
    journey: [step('senate', 'Senat'), step('camera', 'Cameră')],
    voteChamber: decisive ? (isCam ? 'CAMERA DEPUTAȚILOR' : 'SENAT') : null,
    votesFor: decisive ? (isCam ? law.camera_for : law.senate_for) : null,
    votesAgainst: decisive ? (isCam ? law.camera_against : law.senate_against) : null,
    votesAbstain: decisive ? (isCam ? law.camera_abstentions : law.senate_abstentions) : null,
    parties: decisive ? fillTrueAbsents(toParties(breakdownRows), seatsByParty) : [],
  }
}

export const SAMPLE_VOTE_CARD: VoteCardData = {
  lawCode: 'L 412/2026', lawTitle: 'Transparență parlamentară', chamber: 'SENAT', result: 'ADOPTAT', year: 2026,
  dateLabel: '12 iunie 2026',
  votesFor: 187, votesAgainst: 45, votesAbstain: 12, votesNotVoted: 0, votesAbsent: 23, seats: 267, source: 'senat.ro',
  parties: [
    { name: 'PSD', for: 60, against: 2, abstain: 1, absent: 5 },
    { name: 'PNL', for: 50, against: 1, abstain: 2, absent: 4 },
    { name: 'AUR', for: 5, against: 30, abstain: 3, absent: 6 },
    { name: 'USR', for: 40, against: 2, abstain: 1, absent: 3 },
    { name: 'UDMR', for: 18, against: 1, abstain: 1, absent: 2 },
  ],
}
