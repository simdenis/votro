// One plain sentence on what happens after a final vote — shared by the vote
// story and the recap slides so the two never say different things.

export function nextAfterVote(
  vote: { chamber: string; outcome: string | null },
  law: { presidential_status?: string | null; senate_outcome?: string | null; camera_outcome?: string | null } | null,
  code: string,
): string | null {
  if (/^PH\s?CD/i.test(code.replace(/\s/g, ''))) return 'Hotărârea Camerei e definitivă, nu mai trece prin Senat.'
  if (!law || law.presidential_status) return null
  const other = vote.chamber === 'senate' ? 'camera' : 'senate'
  const otherName = other === 'senate' ? 'Senatul' : 'Camera Deputaților'
  if (law[`${other}_outcome`]) {
    return vote.outcome === 'adoptat' ? 'Merge la Președinte pentru promulgare.' : 'Proiectul e respins definitiv.'
  }
  return `Urmează ${otherName}, care are ultimul cuvânt.`
}

/** After the President's decision (or while it is pending). */
export function nextAfterParliament(presidential: string | null | undefined, deCand: string | null | undefined): string {
  if (presidential === 'promulgat') return deCand?.trim() || 'Intră în vigoare după publicarea în Monitorul Oficial.'
  if (presidential === 'retrimis') return 'Președintele a retrimis-o Parlamentului pentru reexaminare.'
  if (presidential === 'sesizat_ccr') return 'Curtea Constituțională decide dacă e constituțională.'
  return 'Președintele are 20 de zile să o promulge sau să o retrimită.'
}
