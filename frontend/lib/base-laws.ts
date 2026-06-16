export interface BaseLaw {
  code:  string   // e.g. "L287/2009"
  name:  string   // e.g. "Codul Civil"
  short: string   // e.g. "Cod Civil"
}

// Major Romanian base laws — detected by number OR canonical name in title
const BASE_LAWS: BaseLaw[] = [
  { code: 'L287/2009', name: 'Codul Civil',                    short: 'Cod Civil' },
  { code: 'L286/2009', name: 'Codul Penal',                    short: 'Cod Penal' },
  { code: 'L134/2010', name: 'Codul de Procedură Civilă',      short: 'CPC' },
  { code: 'L135/2010', name: 'Codul de Procedură Penală',      short: 'CPP' },
  { code: 'L53/2003',  name: 'Codul Muncii',                   short: 'Cod Muncii' },
  { code: 'L227/2015', name: 'Codul Fiscal',                   short: 'Cod Fiscal' },
  { code: 'L207/2015', name: 'Codul de Procedură Fiscală',     short: 'CPF' },
  { code: 'L57/2019',  name: 'Codul Administrativ',            short: 'Cod Adm.' },
  { code: 'L46/2008',  name: 'Codul Silvic',                   short: 'Cod Silvic' },
  { code: 'L95/2006',  name: 'Legea Sănătății',                short: 'L. Sănătății' },
  { code: 'L198/2023', name: 'Legea Educației Naționale',      short: 'L. Educației' },
  { code: 'L1/2011',   name: 'Legea Educației (2011)',         short: 'L. Educației' },
  { code: 'L188/1999', name: 'Statutul Funcționarilor Publici', short: 'Statut FP' },
  { code: 'L303/2004', name: 'Statutul Magistraților',         short: 'Statut Magistrați' },
  { code: 'L176/2010', name: 'Legea Integrității',             short: 'L. Integrității' },
]

// Name patterns (case-insensitive) mapped to codes
const NAME_PATTERNS: [RegExp, string][] = [
  [/codului\s+civil|codul\s+civil/i,                       'L287/2009'],
  [/codului\s+penal|codul\s+penal/i,                       'L286/2009'],
  [/codului\s+de\s+procedur[aă]\s+civil[aă]/i,             'L134/2010'],
  [/codului\s+de\s+procedur[aă]\s+penal[aă]/i,             'L135/2010'],
  [/codului\s+muncii|codul\s+muncii/i,                     'L53/2003'],
  [/codului\s+fiscal|codul\s+fiscal/i,                     'L227/2015'],
  [/codului\s+de\s+procedur[aă]\s+fiscal[aă]/i,            'L207/2015'],
  [/codului\s+administrativ|codul\s+administrativ/i,       'L57/2019'],
  [/codului\s+silvic|codul\s+silvic/i,                     'L46/2008'],
]

const BY_CODE = new Map(BASE_LAWS.map(l => [l.code, l]))

export function detectBaseLaws(title: string): BaseLaw[] {
  const found = new Map<string, BaseLaw>()

  // Match by canonical name
  for (const [pattern, code] of NAME_PATTERNS) {
    if (pattern.test(title)) {
      const law = BY_CODE.get(code)
      if (law) found.set(code, law)
    }
  }

  // Match by "Legii nr. X/YYYY" or "Legea nr. X/YYYY"
  const numRe = /[Ll]egi[ei]?\s+nr\.\s*(\d+)\s*\/\s*(\d{4})/g
  let m: RegExpExecArray | null
  while ((m = numRe.exec(title)) !== null) {
    const code = `L${m[1]}/${m[2]}`
    const law = BY_CODE.get(code)
    if (law) found.set(code, law)
  }

  return Array.from(found.values())
}
