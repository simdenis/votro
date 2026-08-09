// politicians.party_id is nullable, so a joined `parties` comes back null for
// party-less MPs. A `parties!inner` join drops them entirely (silently); a left
// join keeps them but needs this fallback so they still render and bucket.
export const FALLBACK_PARTY = { abbreviation: 'fără partid', color: '#9e9e9e' }

export function partyOf(
  pol: { parties: { abbreviation: string; color: string } | null },
): { abbreviation: string; color: string } {
  return pol.parties ?? FALLBACK_PARTY
}
