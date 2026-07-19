export type PresidentialStatus = 'promulgat' | 'retrimis' | 'sesizat_ccr'
export type CcrDecision = 'constitutional' | 'neconstitutional' | 'partial_neconstitutional'

export interface LawStatus {
  law_id: string
  code: string
  title: string
  law_category: string | null
  summary: string | null
  summary_is_ai: boolean
  em_url: string | null
  presidential_status: PresidentialStatus | null
  presidential_date: string | null
  ccr_decision: CcrDecision | null
  ccr_date: string | null
  senate_vote_id: string | null
  senate_vote_date: string | null
  senate_outcome: 'adoptat' | 'respins' | null
  senate_for: number | null
  senate_against: number | null
  senate_abstentions: number | null
  camera_vote_id: string | null
  camera_vote_date: string | null
  camera_outcome: 'adoptat' | 'respins' | null
  camera_for: number | null
  camera_against: number | null
  camera_abstentions: number | null
  status: 'complet' | 'asteapta_camera' | 'asteapta_senat' | 'necunoscut'
}

export interface Party {
  id: string
  name: string
  abbreviation: string
  color: string
  created_at: string
}

export interface Politician {
  id: string
  name: string
  first_name: string
  party_id: string | null
  chamber: 'senate' | 'deputies'
  senat_profile_url: string | null
  created_at: string
}

export interface Law {
  id: string
  code: string
  title: string
  law_category: string | null
  summary: string | null
  summary_is_ai: boolean
  em_url: string | null
  scraped_at: string
  /** Gemini public-interest score 1–100 (migration 025) — "hotness". */
  interest_score: number | null
}

export interface Vote {
  id: string
  law_id: string | null
  vote_date: string
  vote_type: string | null
  present_count: number | null
  for_count: number | null
  against_count: number | null
  abstention_count: number | null
  not_voted_count: number | null
  outcome: 'adoptat' | 'respins' | null
  chamber: 'senate' | 'deputies'
  senat_app_id: string | null
  cdep_vote_id: number | null
  /** Vote subject from the source page — the only text for law-less votes. */
  description: string | null
  created_at: string
}

/** Official source URL for a vote on cdep.ro / senat.ro. */
export function voteSourceUrl(vote: Pick<Vote, 'chamber' | 'senat_app_id' | 'cdep_vote_id'>): string | null {
  if (vote.chamber === 'deputies' && vote.cdep_vote_id != null) {
    return `https://www.cdep.ro/ords/pls/steno/evot2015.nominal?idv=${vote.cdep_vote_id}&idl=1`
  }
  if (vote.chamber === 'senate' && vote.senat_app_id) {
    return `https://www.senat.ro/VoturiPlenDetaliu.aspx?AppID=${vote.senat_app_id}`
  }
  return null
}

export type VoteChoice = 'for' | 'against' | 'abstention' | 'not_voted' | 'absent'

export interface PoliticianVote {
  id: string
  politician_id: string
  vote_id: string
  vote_choice: VoteChoice
  party_line_deviation: boolean
  created_at: string
}

// ── View types ───────────────────────────────────────────────

export interface PoliticianStats {
  politician_id: string
  name: string
  first_name: string
  party_id: string
  party_name: string
  party_abbr: string
  party_color: string
  total_votes: number
  votes_for: number
  votes_against: number
  votes_abstention: number
  votes_absent: number
  deviations: number
  deviation_pct: number | null
  presence_pct: number | null
  active: boolean
  county: string | null
  /** 'premier' | 'vicepremier' | 'ministru' — MPs in the Government don't vote. */
  gov_role: string | null
  /** Present-but-didn't-press rows (subset of votes_absent). */
  votes_not_voted: number
  /** Plenary votes held in the member's chamber since mandate start —
      the real absence denominator (sources don't list every absentee). */
  chamber_votes: number
  /** Curator note explaining a documented/structural absence (medical leave,
      official delegation…). Null for most MPs. See migration 033. */
  context_note?: string | null
  context_note_url?: string | null
}

/** True absences: chamber votes held minus every recorded participation. */
export function trueAbsent(s: PoliticianStats): number | null {
  if (!s.chamber_votes) return null
  return Math.max(
    0,
    s.chamber_votes - s.votes_for - s.votes_against - s.votes_abstention - (s.votes_not_voted ?? 0),
  )
}

export interface PendingBill {
  id: string
  code: string
  title: string | null
  chamber: 'senate' | 'deputies'
  committee: string | null
  term_days: string | null
  tacit_deadline: string | null
  source_url: string | null
  pdf_url: string | null
  scraped_at: string
  /** AI fields (migration 037, pending_bills_scorer.py) */
  summary?: string | null
  interest_score?: number | null
  interest_reason?: string | null
}

export type SenatorStats = PoliticianStats

export interface PartyCohesion {
  party_id: string
  name: string
  abbreviation: string
  color: string
  votes_participated: number
  total_active_votes: number
  with_party_votes: number
  deviation_count: number
  cohesion_pct: number | null
}

export interface PartyAbsence {
  party_id: string
  name: string
  abbreviation: string
  color: string
  member_count: number
  absence_pct: number | null
}

export interface PartyVoteBreakdown {
  vote_id: string
  party_id: string
  party_name: string
  party_abbr: string
  party_color: string
  vote_choice: VoteChoice
  count: number
}

export interface PartyMajorityVote {
  vote_id: string
  party_id: string
  party_name: string
  party_abbr: string
  party_color: string
  majority_choice: VoteChoice
  majority_count: number
  vote_date: string
  outcome: 'adoptat' | 'respins' | null
  law_code: string
  law_title: string
}

// ── Joined / enriched shapes returned by Supabase nested selects ────

export type VoteWithLaw = Vote & { laws: Law | null }

export type PoliticianVoteWithDetails = PoliticianVote & {
  politicians: Politician & { parties: Party }
}

export type VoteHistoryRow = PoliticianVote & {
  votes: Vote & { laws: Law | null }
}

export interface PartyHistoryEntry {
  id: string
  politician_id: string
  party_id: string
  from_date: string
  to_date: string | null
  parties: {
    name: string
    abbreviation: string
    color: string | null
  }
}
