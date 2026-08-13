import { describe, it, expect } from 'vitest'
import { formatCdepCode, isOrdinanceBill, normalizeStage } from '@/lib/initiative-stage'

// The stage contract behind /initiative: official wording from the cdep
// listing cell, the senat "Stadiu" field and journey rows → normalized enum.
// The "(respingere)" inversion is the dangerous part — a tally on a REJECTION
// report means "adoptat" = the bill was rejected — so it gets its own block.

describe('normalizeStage — cdep listing raws', () => {
  it('maps first-chamber work stages', () => {
    expect(normalizeStage('la comisii')).toBe('in_comisie')
    expect(normalizeStage('raport depus')).toBe('raport_depus')
    expect(normalizeStage('pe ordinea de zi')).toBe('ordinea_zi')
  })

  it('maps transit and terminal stages', () => {
    expect(normalizeStage(' la Senat')).toBe('la_decizionala')
    expect(normalizeStage('procedura legislativa încetata')).toBe('procedura_incetata')
    expect(normalizeStage('respinsa definitiv')).toBe('respins_definitiv')
    expect(normalizeStage('sesizare de neconstitutionalitate')).toBe('la_ccr')
    expect(normalizeStage('retrasa de initiator')).toBe('retras')
  })

  it('a law number exists only after promulgation', () => {
    expect(normalizeStage('Lege 157/2026')).toBe('promulgat')
    expect(normalizeStage('Lege nr. 12/2025')).toBe('promulgat')
  })

  it('the CCR-window deposit and pre-committee consultation (real listing raws)', () => {
    expect(normalizeStage('la Secretarul general')).toBe('adoptat_final')
    expect(normalizeStage('aviz/ punct de vedere solicitat')).toBe('in_comisie')
    expect(normalizeStage('-')).toBeNull()
  })
})

describe('normalizeStage — senat raws (diacritics stripped internally)', () => {
  it('maps work / transit stages', () => {
    expect(normalizeStage('în lucru, la comisiile permanente ale Senatului')).toBe('in_comisie')
    expect(normalizeStage('la Camera Deputaţilor')).toBe('la_decizionala')
  })

  it('tacit adoption counts as adopted — the bill moved on without a vote', () => {
    expect(
      normalizeStage('adoptat de Senat ca urmare a depasirii termenului de adoptare, potrivit art.75 alin.(2)'),
    ).toBe('adoptat_prima')
  })

  it('plain chamber decisions, first vs decisional', () => {
    expect(normalizeStage('adoptat de Senat')).toBe('adoptat_prima')
    expect(normalizeStage('adoptat de Senat', { decisional: true })).toBe('adoptat_final')
    expect(normalizeStage('adoptat de către Senat')).toBe('adoptat_prima')
    expect(normalizeStage('respins de Senat')).toBe('respins_prima')
    expect(normalizeStage('respins de Senat', { decisional: true })).toBe('respins_definitiv')
  })
})

describe('normalizeStage — the "(respingere)" inversion', () => {
  it('a final vote on rejection is a rejection', () => {
    expect(normalizeStage('vot final (respingere)')).toBe('respins_prima')
    expect(normalizeStage('vot final (respingere)', { decisional: true })).toBe('respins_definitiv')
  })

  it('"adoptat" on a rejection report means rejected', () => {
    expect(normalizeStage('adoptat raportul de respingere')).toBe('respins_prima')
    expect(normalizeStage('propunerea de respingere a fost adoptata')).toBe('respins_prima')
  })

  it('a rejected rejection report is no decision at all', () => {
    expect(normalizeStage('respinsă propunerea de respingere')).toBeNull()
  })

  it('a tally "(pentru respingere)" is a rejection regardless of the verb (L108/2026)', () => {
    const raw = 'respinsa de catre Camera Deputatilor rezultat vot (pentru respingere): pentru=199, contra=85, abtineri=3'
    expect(normalizeStage(raw)).toBe('respins_prima')
    expect(normalizeStage(raw, { decisional: true })).toBe('respins_definitiv')
  })

  it('plain adoption is NOT inverted', () => {
    expect(normalizeStage('adoptat de Senat')).toBe('adoptat_prima')
  })
})

describe('normalizeStage — decidedFirst context', () => {
  it('committee work AFTER the first chamber decided is not "fără vot în plen"', () => {
    expect(normalizeStage('la comisii', { decidedFirst: true })).toBe('la_decizionala')
    expect(normalizeStage('raport depus', { decidedFirst: true })).toBe('la_decizionala')
  })
})

describe('isOrdinanceBill — the "already in force" asterisk', () => {
  it('matches OUG/OG approvals and rejections, both diacritic spellings', () => {
    expect(isOrdinanceBill('Proiect de Lege pentru aprobarea Ordonanţei de urgenţă a Guvernului nr.93/2025')).toBe(true)
    expect(isOrdinanceBill('Proiect de Lege privind aprobarea Ordonanței Guvernului nr.3/2026')).toBe(true)
    expect(isOrdinanceBill('Lege pentru respingerea Ordonanţei de urgenţă a Guvernului nr.1/2026')).toBe(true)
  })

  it('does not match ordinary bills, even ones amending an OUG', () => {
    expect(isOrdinanceBill('Propunere legislativă pentru modificarea Legii nr.198/2023')).toBe(false)
    expect(isOrdinanceBill('Proiect de Lege pentru modificarea Ordonanţei de urgenţă a Guvernului nr.57/2019')).toBe(false)
    expect(isOrdinanceBill(null)).toBe(false)
  })
})

describe('formatCdepCode — official display form', () => {
  it('renders the cdep registry form, leaves everything else alone', () => {
    expect(formatCdepCode('PLx427/2025')).toBe('PL-x 427/2025')
    expect(formatCdepCode('L108/2026')).toBe('L108/2026')
  })
})

describe('normalizeStage — no stage signal', () => {
  it('empty and advisory-only wording map to null', () => {
    expect(normalizeStage('')).toBeNull()
    // "trimis pentru aviz" is an advisory referral, not the fond-committee
    // referral ("trimis pentru raport") — it carries no stage signal
    expect(normalizeStage('trimis pentru aviz la Consiliul Legislativ')).toBeNull()
  })
})
