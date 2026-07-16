import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VoteChoice } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function choiceLabel(choice: VoteChoice | string | null | undefined): string {
  const map: Record<string, string> = {
    for: 'Pentru',
    against: 'Împotrivă',
    abstention: 'Abținere',
    not_voted: 'Nu a votat',
    absent: 'Absent',
  }
  // Null/unknown choices previously rendered as a blank label (L630/2025).
  return (choice && map[choice]) || choice || '—'
}

export function choiceColor(choice: VoteChoice | string): string {
  const map: Record<string, string> = {
    for: 'var(--color-for)',
    against: 'var(--color-against)',
    abstention: 'var(--color-abstention)',
    not_voted: 'var(--faint)',
    absent: 'var(--faint)',
  }
  return map[choice] ?? 'var(--faint)'
}

/** Catch-all labels for members without a real party (unaffiliated, national
 *  minorities). No party line exists for them: no deviations, no cohesion. */
/** Nominal seat totals for the 2024–2028 legislature — FALLBACK ONLY.
 *  The absentee denominator is lib/seats.ts activeSeats(): the DB's active
 *  mandates now track cdep/senat exactly (ended mandates deactivate, ministers
 *  who never voted are inserted), including vacancies these totals miss. */
export const CHAMBER_SEATS = { senate: 134, deputies: 331 } as const

export const NO_LINE_PARTIES: readonly string[] = ['IND', 'MIN', 'P']

export function hasPartyLine(abbr: string | null | undefined): boolean {
  return !!abbr && !NO_LINE_PARTIES.includes(abbr)
}

/** OG routes interpolate ?id= into PostgREST URLs — accept only real UUIDs. */
export function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/** Human, shareable law URL slug. Codes are "L597/2025" / "PLx12/2026" — one
 *  slash, no spaces — so "/" ⇄ "-" round-trips unambiguously. */
export function lawSlug(code: string): string {
  return code.replace('/', '-')
}
export function slugToCode(slug: string): string {
  return slug.replace('-', '/')
}

// MUST match the SQL generated column in migration 031 exactly, or slug links
// won't resolve. Same FROM/TO translate maps, same "collapse to dash" regex.
const SLUG_FROM = 'ăâîșțşţáàäéèêíóòöőúùüű'
const SLUG_TO   = 'aaiststaaaeeeioooouuuu'
/** Human politician URL slug, e.g. ("Victor-Viorel","Ponta") → "victor-viorel-ponta". */
export function personSlug(firstName: string | null | undefined, name: string | null | undefined): string {
  const lower = `${firstName ?? ''} ${name ?? ''}`.toLowerCase()
  const folded = Array.from(lower).map(ch => {
    const i = SLUG_FROM.indexOf(ch)
    return i >= 0 ? SLUG_TO[i] : ch
  }).join('')
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function textOnColor(bgHex: string): string {
  // PNL yellow needs black text; everything else uses white
  return bgHex === '#ffdd00' ? '#000000' : '#ffffff'
}

/** Romanian numerals take "de" before the noun when the last two digits are
 *  00 or ≥20: 4 devieri / 20 de devieri / 101 senatori / 120 de senatori. */
export function needsDe(n: number): boolean {
  const r = Math.abs(n) % 100
  return n !== 0 && (r === 0 || r >= 20)
}

/** Romanian count + noun: 1 deviere / 4 devieri / 20 de devieri. */
export function countNoun(n: number, one: string, many: string): string {
  return n === 1 ? one : needsDe(n) ? `de ${many}` : many
}

/** Official bill titles are grammatical continuations ("pentru modificarea…") —
    displayed standalone they read as broken. Capitalize the first letter. */
export function capFirst(s: string | null | undefined): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function pct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

/** Contested-vote threshold used by party cohesion: the minority camp
 *  (FOR vs AGAINST+ABSTAIN) gathered at least this % of votes cast.
 *  MUST match supabase/migrations/027_contested_cohesion.sql — the UI copy
 *  interpolates this constant so the wording can't drift from the data. */
export const CONTESTED_MIN_PCT = 20

type LoyaltyInput = {
  votes_for: number; votes_against: number; votes_abstention: number
  deviations: number; chamber_votes: number; total_votes: number
}

/** Loyalty and presence are TWO variables and must never be folded into one
 *  number — an earlier version divided aligned votes by ALL chamber votes, so
 *  an absentee read as a rebel (Ponta: 96% aligned on votes cast, but the badge
 *  showed 41%). We report them separately, each with its own denominator:
 *    loyalty  = votes WITH the party line / votes EXPRESSED   (397/415 = 96%)
 *    presence = votes EXPRESSED           / chamber votes held (415/958 = 43%)
 *  Loyalty is floored so a 0.4% deviation doesn't round up to 100. */
export function loyaltyParts(s: LoyaltyInput): {
  expressed: number; withParty: number; chamber: number; loyaltyPct: number | null
} {
  const expressed = (s.votes_for ?? 0) + (s.votes_against ?? 0) + (s.votes_abstention ?? 0)
  const withParty = Math.max(0, expressed - (s.deviations ?? 0))
  const chamber   = s.chamber_votes || s.total_votes || 0
  // Presence is NOT computed here on purpose — it has its own canonical metric
  // (presence_pct, which counts "present but didn't press"). Deriving a second
  // presence figure from expressed/chamber would put two different numbers for
  // the same concept on one page — the very bug this split exists to kill.
  return { expressed, withParty, chamber, loyaltyPct: expressed ? Math.floor((withParty / expressed) * 100) : null }
}

/** Party loyalty over votes EXPRESSED (not chamber total — see loyaltyParts). */
export function loyaltyPct(s: LoyaltyInput): number | null {
  return loyaltyParts(s).loyaltyPct
}

/** Constitution art. 66: ordinary sessions run Feb–Jun and Sep–Dec, so July,
 *  August and January are recess. Returns the next session start, or null when
 *  parliament is in session. Callers should also check that no recent vote
 *  exists — extraordinary sessions can happen during recess. */
export function recessUntil(now: Date = new Date()): string | null {
  const m = now.getMonth()
  if (m === 6 || m === 7) return '1 septembrie'
  if (m === 0) return '1 februarie'
  return null
}

/** The ordinary session that just ended, for recess-mode recaps (art. 66:
 *  Feb–Jun and Sep–Dec). Null while parliament is in session. */
export function lastSessionRange(now: Date = new Date()): { from: string; to: string; label: string } | null {
  const m = now.getMonth(), y = now.getFullYear()
  if (m === 6 || m === 7) return { from: `${y}-02-01`, to: `${y}-06-30`, label: `februarie–iunie ${y}` }
  if (m === 0) return { from: `${y - 1}-09-01`, to: `${y - 1}-12-31`, label: `septembrie–decembrie ${y - 1}` }
  return null
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  2)  return 'chiar acum'
  if (hours <  1)  return `acum ${mins} min`
  if (hours <  24) return `acum ${hours}h`
  if (days  === 1) return 'ieri'
  if (days  <  7)  return `acum ${days} zile`
  return formatDateShort(dateStr.slice(0, 10))
}
