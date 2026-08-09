// Administrative/procedural plenary votes with no linked bill — presence checks,
// work-schedule and agenda votes, leftover test votes. They're real records but
// noise on a bill-tracking site, so the public listings (voturi page, sitemap)
// hide them. Substantive law-less votes (motions, regulation changes) are kept.

const PROCEDURAL_RE = /^prezen|verificare prezen|program.*lucru|ordin.*zi|vot test/i

export function isProceduralVote(v: { law_id?: string | null; description?: string | null }): boolean {
  if (v.law_id) return false
  return !!v.description && PROCEDURAL_RE.test(v.description)
}

// PostgREST `.or()` argument: keep a vote if it has a linked bill, or it's a
// law-less vote whose description matches none of the procedural patterns above.
export const KEEP_NON_PROCEDURAL =
  'law_id.not.is.null,' +
  'and(' +
    'description.not.ilike.prezen*,' +
    'description.not.ilike.*verificare prezen*,' +
    'description.not.ilike.*program*lucru*,' +
    'description.not.ilike.*ordin*zi*,' +
    'description.not.ilike.*vot test*' +
  ')'
