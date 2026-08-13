// Normalized initiative stages — mirrors scraper/initiative_scraper.py, which
// writes initiatives.stage. The mapping lives here too so the frontend can
// label stage_raw fallbacks and so the semantics are unit-tested (vitest).
//
// in_comisie / raport_depus / ordinea_zi are reserved for the FIRST chamber:
// no plenary decision anywhere yet. The "fără vot în plen" filter is exactly
// these three. Once the first chamber decides (vote or tacit adoption), the
// row becomes adoptat_prima / respins_prima / la_decizionala and onward —
// even if the bill is again sitting in a committee, now at the decisional
// chamber (ctx.decidedFirst).

export const STAGES = [
  'in_comisie', 'raport_depus', 'ordinea_zi',
  'adoptat_prima', 'respins_prima', 'la_decizionala',
  'adoptat_final', 'respins_definitiv',
  'procedura_incetata', 'retras', 'la_ccr', 'promulgat',
] as const
export type Stage = (typeof STAGES)[number]

export const NO_PLENARY_VOTE: Stage[] = ['in_comisie', 'raport_depus', 'ordinea_zi']

export const STAGE_LABELS: Record<Stage, string> = {
  in_comisie: 'în comisie',
  raport_depus: 'raport depus',
  ordinea_zi: 'pe ordinea de zi',
  adoptat_prima: 'adoptat de prima cameră',
  respins_prima: 'respins de prima cameră',
  la_decizionala: 'la camera decizională',
  adoptat_final: 'adoptat, spre promulgare',
  respins_definitiv: 'respins definitiv',
  procedura_incetata: 'procedură încetată',
  retras: 'retras',
  la_ccr: 'la CCR',
  promulgat: 'promulgat',
}

const strip = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')

/** Internal "PLx427/2025" (laws-table convention) → official "PL-x 427/2025",
    so the code on screen matches cdep.ro and is findable with Ctrl-F. */
export function formatCdepCode(code: string): string {
  const m = code.match(/^PLx(\d+)\/(\d{4})$/)
  return m ? `PL-x ${m[1]}/${m[2]}` : code
}

/** Bills that approve or reject a government ordinance (OUG/OG). The ordinance
    is already in force since its Monitorul Oficial publication — the wait for
    this vote delays only parliament's confirmation, not the rules themselves.
    Marked with an asterisk on /initiative. */
export function isOrdinanceBill(title: string | null | undefined): boolean {
  return !!title && /(aprobarea|respingerea) ordonantei/.test(strip(title))
}

export interface StageCtx {
  /** the raw text describes the decisional chamber's own decision */
  decisional?: boolean
  /** the first chamber has already decided (vote or tacit) — committee/report
      stages then mean "working at the decisional chamber", not "fără vot" */
  decidedFirst?: boolean
}

/** Official stage wording (cdep listing cell, senat Stadiu, journey rows)
    → normalized enum. Returns null when the wording carries no stage signal. */
export function normalizeStage(raw: string, ctx: StageCtx = {}): Stage | null {
  const t = strip(raw).replace(/\s+/g, ' ').trim()
  if (!t) return null

  // "Lege 157/2026" — a law number exists only after promulgation
  if (/\blege\b\s*(nr\.?\s*)?\d+\/\d{4}/.test(t)) return 'promulgat'
  if (/promulgat/.test(t)) return 'promulgat'

  // CCR before the plain vote verbs: "sesizare de neconstituționalitate"
  if (/neconstitutionalitat|curtea constitutional|sesizare.*ccr|\bccr\b/.test(t)) return 'la_ccr'

  if (/respins(a|ă)? definitiv/.test(t)) return 'respins_definitiv'
  if (/procedura legislativa incetata|incetarea procedurii/.test(t)) return 'procedura_incetata'
  if (/retras|retragere/.test(t)) return 'retras'

  // adopted by both chambers, waiting on the president — the cdep listing
  // abbreviates the CCR-window deposit to a bare "la Secretarul general"
  if (/la promulgare|la secretarul general|dreptului de sesizare/.test(t)) return 'adoptat_final'
  // president's re-examination request — back from the final-adoption stage
  if (/reexaminar/.test(t)) return 'adoptat_final'

  // ── plenary decisions — the "(respingere)" inversion lives here ──
  // A tally on a REJECTION report: "adoptat" means the bill was rejected.
  if (/respins(a|ă)? (propunerea|raportul) de respingere/.test(t)) return null // rejection report failed — no decision
  if (/(\(respingere\)|propunerea de respingere|raportul de respingere).*adoptat|adoptat.*(\(respingere\)|propunerea de respingere|raportul de respingere)/.test(t))
    return ctx.decisional ? 'respins_definitiv' : 'respins_prima'
  if (/vot final \(respingere\)/.test(t))
    return ctx.decisional ? 'respins_definitiv' : 'respins_prima'
  // "rezultat vot (pentru respingere)" — the tally is on the rejection itself,
  // so whatever verb precedes it, the bill was rejected (L108/2026).
  if (/\(pentru respingere\)/.test(t))
    return ctx.decisional ? 'respins_definitiv' : 'respins_prima'
  if (/respins(a|ă)? de( catre)? (senat|camera)/.test(t))
    return ctx.decisional ? 'respins_definitiv' : 'respins_prima'
  // includes tacit adoption ("ca urmare a depasirii termenului")
  if (/adoptat(a|ă)? de( catre)? (senat|camera)/.test(t))
    return ctx.decisional ? 'adoptat_final' : 'adoptat_prima'

  // transiting to / sitting at the other chamber
  if (/^la senat\b|^la camera deputatilor\b/.test(t)) return 'la_decizionala'

  // ── first-chamber work stages (the "sertar" clock) ──
  const working =
    /raport depus|depune raportul/.test(t) ? 'raport_depus'
    : /ordinea de zi/.test(t) ? 'ordinea_zi'
    : /la comisi|trimis pentru raport|in lucru|retrimis la comisi|aviz\/? punct de vedere solicitat/.test(t) ? 'in_comisie'
    : null
  if (working) return ctx.decidedFirst ? 'la_decizionala' : working

  return null
}
