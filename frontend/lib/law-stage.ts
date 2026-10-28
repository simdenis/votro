// Where a law stands per the official registries (initiatives table, scraped
// from the cdep/senat fișe) — what the vote tables alone can't tell:
//   • a chamber that adopted TACITLY (art. 75) has no vote row at all, so
//     law_status looks "în dezbatere" even after the decisional chamber voted
//     (L573/2025: Senate tacit in March, Camera 254–0 in September, card still
//     said ÎN DEZBATERE with a gray Senat step)
//   • whether the law already passed both chambers before any presidential
//     status exists (the "la Secretarul general" window can last weeks)
// Optional everywhere: with no initiatives row the old vote-only logic applies.
import type { LawStatus } from '@/lib/types'

export interface LawStage {
  stage: string | null
  chamber_first: 'senate' | 'deputies' | null
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function fetchLawStage(lawId: string): Promise<LawStage | null> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/initiatives?law_id=eq.${lawId}&select=stage,chamber_first&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } })
    const rows = (await r.json()) as LawStage[] | undefined
    return rows?.[0] ?? null
  } catch {
    return null
  }
}

/** Both chambers are done with the law (adopted): a presidential status, or the
 *  registry says it went to promulgation / the CCR. */
export function passedParliament(law: Pick<LawStatus, 'presidential_status'>, stage?: LawStage | null): boolean {
  return Boolean(law.presidential_status) || stage?.stage === 'adoptat_final' || stage?.stage === 'la_ccr'
}

/** The law is dead, not just rejected by one chamber. A first-chamber
 *  rejection still goes to the decisional chamber, which can adopt it
 *  (L256/2026: Senat respins in June, Camera 205–29 in October, the card
 *  said RESPINSĂ next to «Adoptată»). So: the registry's verdict when there is
 *  one, otherwise the LATER chamber vote decides. */
export function lawRejected(
  law: Pick<LawStatus, 'presidential_status' | 'senate_outcome' | 'camera_outcome' | 'senate_vote_date' | 'camera_vote_date'>,
  stage?: LawStage | null,
): boolean {
  if (stage?.stage === 'respins_definitiv') return true
  if (passedParliament(law, stage)) return false
  const votes = [[law.senate_vote_date, law.senate_outcome], [law.camera_vote_date, law.camera_outcome]]
    .filter(([, o]) => o)
    .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))
  return votes.length > 0 && votes[votes.length - 1][1] === 'respins'
}

/** Chambers that adopted the law without a plenary vote (tacit, art. 75).
 *  The first chamber is tacit when the law moved on to the decisional one
 *  without a vote row; the decisional chamber only when the law passed. */
export function tacitChambers(
  law: Pick<LawStatus, 'presidential_status' | 'senate_vote_id' | 'camera_vote_id'>,
  stage?: LawStage | null,
): { senate: boolean; camera: boolean } {
  const passed = passedParliament(law, stage)
  const first = stage?.chamber_first === 'deputies' ? 'camera' : stage?.chamber_first === 'senate' ? 'senate' : null
  const firstDone = passed || stage?.stage === 'la_decizionala' || stage?.stage === 'adoptat_prima'
  return {
    senate: !law.senate_vote_id && (passed || (first === 'senate' && firstDone)),
    camera: !law.camera_vote_id && (passed || (first === 'camera' && firstDone)),
  }
}
