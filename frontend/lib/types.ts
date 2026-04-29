export interface LawStatus {
  law_id: string
  code: string
  title: string
  law_category: string | null
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
  scraped_at: string
}

export interface Vote {
  id: string
  law_id: string
  vote_date: string
  vote_type: string | null
  present_count: number | null
  for_count: number | null
  against_count: number | null
  abstention_count: number | null
  not_voted_count: number | null
  outcome: 'adoptat' | 'respins' | null
  senat_app_id: string
  created_at: string
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

export type VoteWithLaw = Vote & { laws: Law }

export type PoliticianVoteWithDetails = PoliticianVote & {
  politicians: Politician & { parties: Party }
}

export type VoteHistoryRow = PoliticianVote & {
  votes: Vote & { laws: Law }
}
