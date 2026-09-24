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
