import { notFound } from 'next/navigation'
import { getDB } from '@/lib/supabase'
import { PublishCard, ManualPublish } from '@/components/admin/publish-panel'

// Curation dashboard: see the candidate cards, pick, publish to Instagram.
// Gated by ?key=<ADMIN_KEY> (worker secret) — anything else 404s, so the page
// doesn't exist for the public. The key is embedded in the served HTML for the
// publish calls, which is fine: only the key holder ever gets this HTML.
//
// ?img=<b64url>&cap=<b64url> prefill the manual form — the monthly absence
// approval email links here with the signed shamecard URL + caption.

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Admin — postări',
  robots: { index: false, follow: false },
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')
const CANDIDATE_DAYS = 14

const STATUS_LINE: Record<string, string> = {
  promulgat: 'Promulgată — urmează publicarea în Monitorul Oficial.',
  retrimis: 'Retrimisă de Președinte în Parlament pentru reexaminare.',
  sesizat_ccr: 'Contestată la Curtea Constituțională.',
}

function b64urlDecode(s: string | undefined): string {
  if (!s) return ''
  try {
    return Buffer.from(s, 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

type FinalVote = {
  law_id: string; chamber: string; vote_date: string | null
  for_count: number | null; against_count: number | null; outcome: string | null
}

async function fetchCandidates() {
  const db = getDB()
  const cutoff = new Date(Date.now() - CANDIDATE_DAYS * 86400_000).toISOString().slice(0, 10)

  const [{ data: votes }, { data: presLaws }] = await Promise.all([
    db.from('votes')
      .select('law_id, chamber, vote_date, for_count, against_count, outcome')
      .eq('vote_type', 'vot final').not('law_id', 'is', null).gte('vote_date', cutoff),
    db.from('laws').select('id').gte('presidential_date', cutoff),
  ])

  const votesByLaw = new Map<string, FinalVote[]>()
  for (const v of (votes ?? []) as FinalVote[]) {
    votesByLaw.set(v.law_id, [...(votesByLaw.get(v.law_id) ?? []), v])
  }
  const ids = [...new Set([...votesByLaw.keys(), ...(presLaws ?? []).map(l => l.id)])]
  if (!ids.length) return []

  const { data: laws } = await getDB()
    .from('laws')
    .select('id, code, title, summary, presidential_status, interest_score, interest_reason')
    .in('id', ids)
  return (laws ?? [])
    .sort((a, b) => (b.interest_score ?? -1) - (a.interest_score ?? -1))
    .slice(0, 8)
    .map(l => {
      const last = (votesByLaw.get(l.id) ?? [])
        .sort((a, b) => (b.vote_date ?? '').localeCompare(a.vote_date ?? ''))[0]
      return { ...l, lastVote: last ?? null }
    })
}

function lawCaption(l: Awaited<ReturnType<typeof fetchCandidates>>[number]): string {
  const lines = [`📋 ${l.code} — pe scurt`, '']
  if (l.summary) lines.push(l.summary.length > 500 ? l.summary.slice(0, 497).trimEnd() + '…' : l.summary, '')
  if (l.presidential_status && STATUS_LINE[l.presidential_status]) {
    lines.push(STATUS_LINE[l.presidential_status], '')
  } else if (l.lastVote) {
    const ch = l.lastVote.chamber === 'senate' ? 'Senat' : 'Camera Deputaților'
    const oc = l.lastVote.outcome === 'respins' ? 'Respinsă' : 'Adoptată'
    lines.push(`${oc} în ${ch}: ${l.lastVote.for_count ?? 0} pentru, ${l.lastVote.against_count ?? 0} împotrivă.`, '')
  }
  lines.push(`Cum a votat fiecare parlamentar: ${SITE}/legi/${l.id} (link în bio)`, '',
             '#parlament #legi #laButoane #transparență #românia')
  return lines.join('\n')
}

async function fetchShameCaption(): Promise<string> {
  const db = getDB()
  const [{ data: sen }, { data: dep }] = await Promise.all([
    db.from('senator_stats').select('name, first_name, party_abbr, presence_pct')
      .eq('active', true).is('gov_role', null).order('presence_pct', { ascending: true }).limit(5),
    db.from('deputy_stats').select('name, first_name, party_abbr, presence_pct')
      .eq('active', true).is('gov_role', null).order('presence_pct', { ascending: true }).limit(5),
  ])
  const entries = [
    ...(sen ?? []).map(s => ({ ...s, chamber: 'Senat' })),
    ...(dep ?? []).map(s => ({ ...s, chamber: 'Cameră' })),
  ]
    .map(s => ({ pct: Math.round(100 - (s.presence_pct ?? 100)), name: `${s.first_name} ${s.name}`, party: s.party_abbr, chamber: s.chamber }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)
  return [
    '🔴 Absențe — top 5: cei mai absenți parlamentari', '',
    'Absențe la voturile din plen, de la începutul legislaturii (20 decembrie 2024):', '',
    ...entries.map((e, i) => `${i + 1}. ${e.name} (${e.party}, ${e.chamber}) — ${e.pct}% absențe`),
    '', 'Membrii Guvernului nu sunt incluși — ei nu votează în plen.',
    '', `Toată lista: ${SITE}`, '',
    '#parlament #absenteism #laButoane #transparență #românia',
  ].join('\n')
}

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ key?: string; img?: string; cap?: string }>
}) {
  const sp = await searchParams
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey || sp.key !== adminKey) notFound()

  const [candidates, shameCaption] = await Promise.all([fetchCandidates(), fetchShameCaption()])
  const prefillImg = b64urlDecode(sp.img)
  const prefillCap = b64urlDecode(sp.cap)

  return (
    <div className="max-w-[860px]">
      <h1 className="text-xl font-bold">Postări — alege și publică</h1>
      <p className="text-[13px] text-muted mt-1">
        Publicarea merge direct pe @vot.romania — butonul cere o a doua apăsare de confirmare.
        Previzualizările pot da 503 (limita CPU pe planul Free) — reîncarcă.
      </p>

      {(prefillImg || prefillCap) && (
        <section className="mt-8">
          <h2 className="text-[15px] font-bold text-respins">Din emailul de aprobare</h2>
          <div className="mt-3">
            <ManualPublish adminKey={adminKey} initialImages={prefillImg} initialCaption={prefillCap} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[15px] font-bold">Candidați — legi cu vot final / promulgare în ultimele {CANDIDATE_DAYS} zile</h2>
        <p className="text-[12px] text-faint mt-0.5">
          Sortate după scorul de interes. Butonul publică doar cardul-rezumat; pentru caruselul
          complet (hemiciclu + camere) folosește comanda copiată — slide-urile grele se randează offline.
        </p>
        <div className="mt-4 flex flex-col gap-8">
          {candidates.length === 0 && <p className="text-[13px] text-faint">Nicio lege cu activitate decisivă recentă.</p>}
          {candidates.map(l => (
            <div key={l.id} className="border border-rim rounded-xl p-4">
              <div className="flex items-baseline gap-2 flex-wrap mb-3">
                <span className="text-[13px] font-bold">{l.code}</span>
                {l.interest_score != null && (
                  <span className="text-[11px] text-faint">interes {l.interest_score}/100{l.interest_reason ? ` — ${l.interest_reason}` : ''}</span>
                )}
              </div>
              <p className="text-[12.5px] text-muted mb-3">{l.title.length > 160 ? l.title.slice(0, 157) + '…' : l.title}</p>
              <PublishCard
                adminKey={adminKey}
                image={`${SITE}/api/og/summarycard?id=${l.id}`}
                initialCaption={lawCaption(l)}
                command={`node scripts/render-ig.mjs ${l.id} && npm run deploy && cd ../scraper && .venv/bin/python instagram_poster.py --law ${l.id} --static`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-bold">Absențe — top 5 (tot mandatul)</h2>
        <p className="text-[12px] text-faint mt-0.5">Varianta lunară vine pe email pe 1 ale lunii, cu verificările de context.</p>
        <div className="mt-3 border border-rim rounded-xl p-4">
          <PublishCard adminKey={adminKey} image={`${SITE}/api/og/shamecard`} initialCaption={shameCaption} />
        </div>
      </section>

      <section className="mt-10 mb-8">
        <h2 className="text-[15px] font-bold">Postare manuală</h2>
        <p className="text-[12px] text-faint mt-0.5">Orice URL de card de pe {SITE} — un URL pe linie, 2+ = carusel.</p>
        <div className="mt-3 border border-rim rounded-xl p-4">
          <ManualPublish adminKey={adminKey} />
        </div>
      </section>
    </div>
  )
}
