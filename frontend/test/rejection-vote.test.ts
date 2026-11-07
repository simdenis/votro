import { describe, it, expect } from 'vitest'
import { isRejectionVote, choiceLabel } from '@/lib/utils'

// L262/2026 (Senat, 2 iun. 2026): «raport de respingere», 72–31–1. «Pentru» was
// for REJECTING the bill; the site printed "72 pentru · Respins".
describe('rejection-report votes', () => {
  it('detects the stored vote_type', () => {
    expect(isRejectionVote('vot final (respingere)')).toBe(true)
    expect(isRejectionVote('vot final')).toBe(false)
    expect(isRejectionVote('')).toBe(false)
    expect(isRejectionVote(null)).toBe(false)
  })
  it('labels positions as for/against the rejection', () => {
    expect(choiceLabel('for', true)).toBe('Pentru respingere')
    expect(choiceLabel('against', true)).toBe('Împotriva respingerii')
    expect(choiceLabel('abstention', true)).toBe('Abținere')
    expect(choiceLabel('for')).toBe('Pentru')
  })
})
