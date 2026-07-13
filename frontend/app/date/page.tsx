import type { Metadata } from 'next'
import { SectionNav, DESPRE_SECTIONS } from '@/components/section-nav'

export const metadata: Metadata = {
  title: 'Date deschise',
  description: 'API public și export CSV/JSON cu toate voturile Parlamentului României — pentru jurnaliști, cercetători și dezvoltatori.',
}

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TABLES: { name: string; desc: string }[] = [
  { name: 'votes',                'desc': 'toate voturile de plen (dată, cameră, rezultat, numărători)' },
  { name: 'politician_votes',     'desc': 'votul fiecărui parlamentar la fiecare vot (pentru/împotrivă/abținere/absent) + devierea de la linia de partid' },
  { name: 'politicians',          'desc': 'parlamentarii: nume, cameră, județ, partid curent, rol în Guvern' },
  { name: 'parties',              'desc': 'partidele parlamentare' },
  { name: 'laws',                 'desc': 'legile urmărite: cod, titlu, categorie, rezumat' },
  { name: 'law_status',           'desc': 'drumul fiecărei legi: voturile din ambele camere + statusul prezidențial' },
  { name: 'senator_stats',        'desc': 'agregate per senator: prezență, devieri, comportament de vot' },
  { name: 'deputy_stats',         'desc': 'agregate per deputat' },
  { name: 'party_cohesion',       'desc': 'coeziunea partidelor pe voturile disputate' },
  { name: 'party_vote_breakdown', 'desc': 'distribuția voturilor pe partid, pentru fiecare vot' },
]

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-raised border border-rim rounded-lg p-3.5 text-[12px] leading-relaxed overflow-x-auto whitespace-pre">
      <code>{children}</code>
    </pre>
  )
}

export default function DatePage() {
  return (
    <div className="max-w-2xl space-y-10">
      <SectionNav items={DESPRE_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Date deschise</h1>
        <p className="text-foreground leading-relaxed mt-4">
          Toate datele LaButoane sunt publice și interogabile direct, fără cont și fără limită de
          utilizare rezonabilă — API REST (PostgREST) cu răspuns JSON sau CSV. Dacă publici ceva pe
          baza lor, un link către la-butoane.ro e tot ce cerem. Datele provin din sursele oficiale
          (senat.ro, cdep.ro) și acoperă voturile de plen începând cu 2 februarie 2026.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Acces rapid</h2>
        <p className="text-sm text-foreground leading-relaxed">
          Fiecare cerere are nevoie de cheia publică de citire (header <code className="text-[12.5px] bg-raised px-1 rounded">apikey</code> — e
          aceeași pe care o folosește site-ul, e sigură de distribuit):
        </p>
        <Code>{`# ultimele 5 voturi, JSON
curl "${U}/rest/v1/votes?select=*&order=vote_date.desc&limit=5" \\
  -H "apikey: ${K}"`}</Code>
        <Code>{`# același lucru, CSV (deschide direct în Excel)
curl "${U}/rest/v1/votes?select=*&order=vote_date.desc&limit=100" \\
  -H "apikey: ${K}" \\
  -H "Accept: text/csv" > voturi.csv`}</Code>
        <Code>{`# cum a votat fiecare partid la un vot anume
curl "${U}/rest/v1/party_vote_breakdown?vote_id=eq.<UUID>" \\
  -H "apikey: ${K}"`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Tabele și view-uri disponibile</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {TABLES.map(t => (
                <tr key={t.name} className="border-b border-rim">
                  <td className="py-2 pr-4 font-mono text-[12.5px] text-foreground whitespace-nowrap align-top">{t.name}</td>
                  <td className="py-2 text-muted">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Paginare și filtre</h2>
        <p className="text-sm text-foreground leading-relaxed">
          Răspunsurile sunt limitate la 1.000 de rânduri; pentru seturi mari folosește header-ul{' '}
          <code className="text-[12.5px] bg-raised px-1 rounded">Range</code>:
        </p>
        <Code>{`# rândurile 0–999, apoi 1000–1999 ș.a.m.d.
curl "${U}/rest/v1/politician_votes?select=*" \\
  -H "apikey: ${K}" \\
  -H "Range: 0-999"`}</Code>
        <p className="text-sm text-muted leading-relaxed">
          Sintaxa completă de filtrare (eq, gte, in, ilike, join-uri cu <code className="text-[12px] bg-raised px-1 rounded">select=*,laws(*)</code>) e
          documentată la{' '}
          <a href="https://postgrest.org/en/stable/references/api/tables_views.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            postgrest.org
          </a>
          . Accesul e read-only, garantat la nivel de bază de date (RLS).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Pentru jurnaliști</h2>
        <p className="text-sm text-foreground leading-relaxed">
          Dacă lucrezi la un material și ai nevoie de un export anume, o verificare de metodologie
          sau context despre limitările datelor (adoptări tacite, absențe structurale ale
          miniștrilor), scrie-ne:{' '}
          <a href="mailto:siminiucdenis@gmail.com" className="underline hover:text-muted">siminiucdenis@gmail.com</a>.
        </p>
      </section>
    </div>
  )
}
