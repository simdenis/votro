import { describe, it, expect } from 'vitest'
import { partyOf, FALLBACK_PARTY } from '@/lib/party'

// Regression guard for the `parties!inner` drop: party-less MPs (party_id null)
// were silently vanishing from vote pages. With a left join, parties comes back
// null and partyOf must keep them under a renderable fallback bucket.

describe('partyOf', () => {
  it('returns the real party when present', () => {
    const party = { abbreviation: 'PSD', color: '#e4002b' }
    expect(partyOf({ parties: party })).toEqual(party)
  })

  it('falls back to "fără partid" when the MP has no party', () => {
    expect(partyOf({ parties: null })).toBe(FALLBACK_PARTY)
    expect(partyOf({ parties: null }).abbreviation).toBe('fără partid')
  })

  it('fallback carries a non-null color so the badge still renders', () => {
    expect(FALLBACK_PARTY.color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
