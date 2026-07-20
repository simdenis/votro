// TS port of the law-carousel slide manifest from scraper/instagram_poster.py
// (_law_slides + _slide_name). The admin page needs it to show the full deck
// and publish pre-rendered static slides. KEEP IN SYNC with the Python side —
// same suffix strings, same sha1 naming, same CARD_V — or the page will look
// for static files under the wrong hashes.

import { createHash } from 'node:crypto'
import type { LawStatus } from '@/lib/types'

/** Mirror of CARD_V in scraper/instagram_poster.py — bump both together. */
export const CARD_V = '11'

/** Deterministic static filename for an og-card suffix (poster contract). */
export function slideName(suffix: string): string {
  return 's-' + createHash('sha1').update(suffix).digest('hex').slice(0, 16) + '.png'
}

export type Slide = { suffix: string; static: string; label: string }

/** Ordered slides for a law carousel: [hook cover] → summary → tacit → chambers
 *  chronologically → deviation (when someone broke the party line).
 *  devVote = the chamber vote with the most deviations, or null.
 *  hasHeadline → prepend the catchy cover slide and drop the headline from the
 *  summary card (nohl) so the phrase isn't repeated. */
export function lawSlides(law: LawStatus, devVote: string | null, hasHeadline = false): Slide[] {
  const v = `&v=${CARD_V}`
  const slides: Slide[] = []
  if (hasHeadline) {
    slides.push({ suffix: `og/hookcard?id=${law.law_id}${v}`, static: '', label: 'cover' })
  }
  slides.push({
    suffix: `og/summarycard?id=${law.law_id}${hasHeadline ? '&nohl=1' : ''}${v}`,
    static: '', label: 'rezumat',
  })
  const passed = Boolean(law.presidential_status)
  for (const [key, voteField] of [['senate', 'senate_vote_id'], ['camera', 'camera_vote_id']] as const) {
    if (passed && !law[voteField]) {
      slides.push({ suffix: `og/tacitcard?id=${law.law_id}&chamber=${key}${v}`, static: '', label: `tacit ${key === 'senate' ? 'Senat' : 'Cameră'}` })
    }
  }
  const chambers: [string, string][] = []
  if (law.senate_vote_id) chambers.push([law.senate_vote_date ?? '', 'senate'])
  if (law.camera_vote_id) chambers.push([law.camera_vote_date ?? '', 'camera'])
  chambers.sort()
  for (const [, key] of chambers) {
    slides.push({ suffix: `og/lawcard?id=${law.law_id}&chamber=${key}${v}`, static: '', label: key === 'senate' ? 'Senat' : 'Cameră' })
  }
  if (devVote) {
    slides.push({ suffix: `og/deviationcard?vote=${devVote}${v}`, static: '', label: 'devieri' })
  }
  return slides.map(s => ({ ...s, static: `/ig/${slideName(s.suffix)}` }))
}

/** Compact "Inițiativă: …" line from initiator_type + the nominal list —
 *  pure formatter shared by the summarycard route and the admin captions. */
export function initiatorLineFromRows(
  itype: string | null,
  rows: { role_raw: string | null; party_raw: string | null }[],
): string | null {
  if (itype === 'guvern') return 'Inițiativă: Guvernul României'
  if (itype === 'cetateni') return 'Inițiativă cetățenească'
  if (itype !== 'parlamentari') return null
  const n = rows.length
  if (!n) return null
  const roles = new Set(rows.map(r => r.role_raw).filter(Boolean))
  const noun = roles.size === 1
    ? (roles.has('senator') ? (n === 1 ? 'senator' : 'senatori') : (n === 1 ? 'deputat' : 'deputați'))
    : (n === 1 ? 'parlamentar' : 'parlamentari')
  const de = n >= 20 ? 'de ' : ''
  // stored party strings can be raw fisa text — minority orgs fold into MIN
  const norm = (p: string) => /minorit/i.test(p.normalize('NFKD')) ? 'MIN' : p.split(/\s+A devenit|\(/)[0].trim()
  const counts: Record<string, number> = {}
  for (const r of rows) if (r.party_raw) { const p = norm(r.party_raw); if (p) counts[p] = (counts[p] ?? 0) + 1 }
  const majority = Object.entries(counts).find(([, c]) => c / n >= 0.8)?.[0]
  const parties = Object.keys(counts)
  if (majority) return `Inițiativă: ${n} ${de}${noun} ${majority}`
  if (parties.length > 3) return `Inițiativă: ${n} ${de}${noun} din ${parties.length}${parties.length >= 20 ? ' de' : ''} partide`
  return `Inițiativă: ${n} ${de}${noun}${parties.length ? ` (${parties.join(', ')})` : ''}`
}

/** Port of the --law caption (minus the optional --hook first line). */
export function lawCarouselCaption(
  law: LawStatus,
  { initiator, devCount, headline }: { initiator: string | null; devCount: number; headline?: string | null },
): string {
  const outcome = ({
    promulgat: 'PROMULGATĂ ✅', retrimis: 'RETRIMISĂ ÎN PARLAMENT ↩️', sesizat_ccr: 'TRIMISĂ LA CCR ⚖️',
  } as Record<string, string>)[law.presidential_status ?? ''] ?? ''
  const passed = Boolean(law.presidential_status)
  const voted = [law.senate_vote_id, law.camera_vote_id].filter(Boolean).length
  const tacit = passed && voted < 2
  // lead with the catchy headline (hook); official code · title on the next line
  const lines = headline?.trim()
    ? [headline.trim(), '', `${law.code} · ${(law.title ?? '').trim()}`]
    : [`${law.code} · ${(law.title ?? '').trim()}`]
  if (law.summary) lines.push('', law.summary.trim())
  if (initiator) lines.push('', initiator)
  if (outcome) lines.push('', outcome)
  if (tacit) {
    const missing = !law.senate_vote_id ? 'Senat' : 'Camera Deputaților'
    lines.push('', `⚠️ Adoptată tacit de ${missing}: termenul constituțional a expirat fără vot (art. 75).`)
  }
  if (devCount) {
    lines.push('', devCount === 1
      ? '⚡ 1 parlamentar a votat împotriva propriului partid (ultimul slide).'
      : `⚡ ${devCount} parlamentari au votat împotriva propriului partid (ultimul slide).`)
  }
  lines.push('', 'Voturile individuale, pe site: link în bio.', '',
             '#parlament #transparență #românia #politică #laButoane')
  return lines.join('\n')
}
