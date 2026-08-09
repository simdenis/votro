import { describe, it, expect } from 'vitest'
import { isProceduralVote } from '@/lib/vote-filters'

// Guards the "hide procedural votes" cleanup: presence/schedule/agenda/test votes
// are noise and must be hidden, but substantive law-less votes (motions,
// regulation changes) and any bill-linked vote must always stay visible.

describe('isProceduralVote', () => {
  it('flags law-less administrative votes', () => {
    for (const description of [
      'Verificare prezenta', 'Prezență', 'Prezenţă',
      'Prelungire program de lucru', 'Programul de lucru',
      'Modificare ordine de zi', 'Ordinea de zi', 'Modificarea ordinii de zi',
      'vot test',
    ]) {
      expect(isProceduralVote({ law_id: null, description })).toBe(true)
    }
  })

  it('keeps substantive law-less votes', () => {
    expect(isProceduralVote({ law_id: null, description: 'Motiune simpla' })).toBe(false)
    expect(isProceduralVote({ law_id: null, description: 'PH - Regulament Senat' })).toBe(false)
  })

  it('never hides a bill-linked vote, whatever the description', () => {
    expect(isProceduralVote({ law_id: 'abc', description: 'Ordinea de zi' })).toBe(false)
    expect(isProceduralVote({ law_id: 'abc', description: 'PL 532/2026 - vot final' })).toBe(false)
  })

  it('handles missing description', () => {
    expect(isProceduralVote({ law_id: null, description: null })).toBe(false)
  })
})
