import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { allRows } from '@/lib/paging'
import { capFirst, formatDate, lawSlug, todayRo } from '@/lib/utils'
import { CategoryBadge } from '@/components/category-badge'
import { NO_PLENARY_VOTE, STAGE_LABELS, type Stage } from '@/lib/initiative-stage'
import type { Initiative } from '@/lib/types'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'

export const revalidate = 600 // ISR — CDN-cache for 10 min
export const metadata: Metadata = {
  title: 'Inițiative legislative',
  description:
    'Toate inițiativele legislative înregistrate la Parlament — inclusiv cele aflate încă în comisie, fără vot în plen — cu stadiul oficial și timpul scurs de la depunere.',
}

type StadiuId = 'fara-vot' | 'adoptate' | 'respinse' | 'la-ccr' | 'promulgate' | 'incetate' | 'toate'

const STADII: { id: StadiuId; label: string; stages: Stage[] | null }[] = [
  { id: 'fara-vot',   label: 'Fără vot în plen', stages: NO_PLENARY_VOTE },
  { id: 'adoptate',   label: 'Adoptate',         stages: ['adoptat_prima', 'la_decizionala', 'adoptat_final'] },
  { id: 'respinse',   label: 'Respinse',         stages: ['respins_prima', 'respins_definitiv'] },
  { id: 'la-ccr',     label: 'La CCR',           stages: ['la_ccr'] },
  { id: 'promulgate', label: 'Promulgate',       stages: ['promulgat'] },
  { id: 'incetate',   label: 'Încetate / retrase', stages: ['procedura_incetata', 'retras'] },
  { id: 'toate',      label: 'Toate',            stages: null },
]

const CAMERE: { id: 'toate' | 'deputies' | 'senate'; label: string }[] = [
  { id: 'toate',    label: 'Ambele' },
  { id: 'deputies', label: 'Camera Deputaților' },
  { id: 'senate',   label: 'Senat' },
]

function chipClass(active: boolean) {
  return `text-[13.5px] px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
    active
      ? 'border-[var(--ink)] text-white bg-[var(--ink)]'
      : 'border-rim text-foreground/75 hover:text-foreground hover:border-foreground/40 hover:bg-raised'
  }`
}

/** Whole days from a past date to today (RO calendar dates, tz-safe). */
function daysSince(dateStr: string, today: string): number {
  const ms = Date.parse(today + 'T00:00:00Z') - Date.parse(dateStr.slice(0, 10) + 'T00:00:00Z')
  return Math.round(ms / 86_400_000)
}

/** senat.ro registry search from "L108/2026". */
function senatUrl(code: string): string | null {
  const m = code.match(/^L?(\d+)\/(\d{4})$/)
  return m ? `https://www.senat.ro/legis/lista.aspx?nr_cls=L${m[1]}&an_cls=${m[2]}` : null
}

/** Small stage pill — only terminal outcomes get a soft tint (law-status-pill
    tones); everything in-flight stays muted. Neutral labels, no verdicts. */
function StagePill({ stage }: { stage: Stage }) {
  const tone =
    stage === 'promulgat' || stage === 'adoptat_final'
      ? { color: 'var(--color-for-dark)', bg: 'rgba(46,168,113,0.12)' }
      : stage === 'respins_definitiv'
        ? { color: 'var(--color-against-dark)', bg: 'rgba(238,123,94,0.14)' }
        : stage === 'la_ccr'
          ? { color: 'var(--color-abstention-dark)', bg: 'rgba(227,162,60,0.16)' }
          : { color: 'var(--muted)', bg: 'var(--raised)' }
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 whitespace-nowrap"
      style={{ color: tone.color, backgroundColor: tone.bg }}
    >
      {STAGE_LABELS[stage]}
    </span>
  )
}

export default async function InitiativePage({
  searchParams,
}: {
  searchParams: Promise<{ stadiu?: string; camera?: string; categorie?: string }>
}) {
  const sp = await searchParams
  const stadiu = (STADII.some(s => s.id === sp.stadiu) ? sp.stadiu : 'fara-vot') as StadiuId
  const camera = (CAMERE.some(c => c.id === sp.camera) ? sp.camera : 'toate') as 'toate' | 'deputies' | 'senate'

  // The registry holds ~2500+ rows — a single select silently truncates at 1000.
  const rows = await allRows<Initiative>((lo, hi) =>
    getDB()
      .from('initiatives')
      .select('*')
      .order('registered_date', { ascending: true, nullsFirst: false })
      .range(lo, hi))

  const categories = [...new Set(rows.map(r => r.law_category).filter((c): c is string => !!c))]
    .sort((a, b) => a.localeCompare(b, 'ro'))
  const categorie = categories.includes(sp.categorie ?? '') ? (sp.categorie as string) : null

  const stages = STADII.find(s => s.id === stadiu)!.stages
  const filtered = rows.filter(r =>
    (!stages || (r.stage != null && stages.includes(r.stage))) &&
    (camera === 'toate' || r.chamber_first === camera) &&
    (!categorie || r.law_category === categorie))

  const today = todayRo()

  function buildUrl(over: { stadiu?: StadiuId; camera?: string; categorie?: string | null }) {
    const st = over.stadiu ?? stadiu
    const ca = over.camera ?? camera
    const cg = over.categorie !== undefined ? over.categorie : categorie
    const p = new URLSearchParams()
    if (st !== 'fara-vot') p.set('stadiu', st)
    if (ca !== 'toate')    p.set('camera', ca)
    if (cg)                p.set('categorie', cg)
    return `/initiative${p.size ? `?${p}` : ''}`
  }

  return (
    <div className="space-y-6">
      <SectionNav items={LEGI_SECTIONS} />
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Inițiative legislative
        </h1>
        <span className="text-[12.5px] text-muted whitespace-nowrap">{filtered.length} afișate</span>
      </div>
      <p className="text-sm text-muted max-w-2xl">
        Toate inițiativele înregistrate la Parlament, din registrele oficiale ale celor două
        camere — inclusiv cele aflate încă în lucru la prima cameră sesizată, înainte de orice
        vot în plen. Două contoare, două lucruri diferite:{' '}
        <strong className="text-foreground">zile de la depunere</strong> curge de la
        înregistrarea inițiativei, <strong className="text-foreground">zile fără raport</strong>{' '}
        de când proiectul e la comisia sesizată în fond. Actualizat zilnic.
      </p>

      {/* Filters — plain GET links, same chip style as /legi */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] uppercase tracking-[0.12em] font-semibold text-faint mr-1">Stadiu</span>
          {STADII.map(s => (
            <Link key={s.id} href={buildUrl({ stadiu: s.id })} className={chipClass(stadiu === s.id)}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] uppercase tracking-[0.12em] font-semibold text-faint mr-1">Prima cameră</span>
          {CAMERE.map(c => (
            <Link key={c.id} href={buildUrl({ camera: c.id })} className={chipClass(camera === c.id)}>
              {c.label}
            </Link>
          ))}
        </div>
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] uppercase tracking-[0.12em] font-semibold text-faint mr-1">Categorie</span>
            <Link href={buildUrl({ categorie: null })} className={chipClass(categorie === null)}>
              Toate
            </Link>
            {categories.map(c => (
              <Link key={c} href={buildUrl({ categorie: c })} className={chipClass(categorie === c)}>
                {c}
              </Link>
            ))}
          </div>
        )}
      </div>

      {stadiu === 'fara-vot' && (
        <p className="text-sm text-muted max-w-2xl">
          Inițiative aflate în lucru la prima cameră sesizată, înainte de orice vot sau adoptare
          tacită în plen. Proiectele adoptate tacit nu apar aici — au mers mai departe fără vot.
        </p>
      )}

      {!rows.length ? (
        <p className="text-sm text-muted py-8">
          Datele nu au putut fi încărcate. Reîncearcă în câteva momente.
        </p>
      ) : !filtered.length ? (
        <p className="text-sm text-muted py-8">
          Nicio inițiativă pentru filtrul selectat — lista se actualizează zilnic.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b-2 border-sidebar text-[11px] uppercase tracking-[0.14em] text-faint">
                <th
                  className="text-left py-3 pr-4 font-medium"
                  title="De la înregistrarea inițiativei în Parlament — alt termen decât cel al raportului de comisie"
                >
                  Zile de la depunere
                </th>
                <th
                  className="text-left py-3 pr-4 font-medium hidden md:table-cell"
                  title="De când proiectul e la comisia sesizată în fond, în așteptarea raportului — termenul curge diferit de cel de la depunere"
                >
                  Zile fără raport
                </th>
                <th className="text-left py-3 pr-4 font-medium">Inițiativă</th>
                <th className="text-left py-3 pr-4 font-medium hidden lg:table-cell">Categorie</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const code = r.senat_code ?? r.cdep_code
                const obiect = r.obiect && r.obiect.length > 200
                  ? r.obiect.slice(0, 197).trimEnd() + '…'
                  : r.obiect
                return (
                  <tr key={r.id} className="border-b border-rim hover:bg-raised transition-colors">
                    <td className="py-3 pr-4 whitespace-nowrap align-top">
                      {r.registered_date ? (
                        <>
                          <span className="font-semibold text-foreground">{daysSince(r.registered_date, today)}</span>
                          <span className="block text-[11px] text-muted mt-1">{formatDate(r.registered_date)}</span>
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap align-top hidden md:table-cell">
                      {r.committee_since
                        ? <span className="text-muted">{daysSince(r.committee_since, today)}</span>
                        : <span className="text-faint">—</span>}
                    </td>
                    <td className="py-3 pr-4 max-w-xl align-top">
                      {r.stage && <div className="mb-1"><StagePill stage={r.stage} /></div>}
                      {/* rows matched to a law get our own detail page; the rest
                          show the official title with the fișă links below */}
                      {r.law_id && code ? (
                        <Link href={`/legi/${lawSlug(code)}`} className="text-foreground hover:underline font-medium">
                          {capFirst(r.title) || code}
                        </Link>
                      ) : (
                        <span className="text-foreground font-medium">{capFirst(r.title) || code}</span>
                      )}
                      {obiect && (
                        <span className="block text-[11.5px] text-faint mt-1 leading-snug">{capFirst(obiect)}</span>
                      )}
                      <span className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-muted mt-0.5">
                        {r.cdep_code && <span>{r.cdep_code}</span>}
                        {r.senat_code && <span>{r.senat_code}</span>}
                        {r.cdep_idp != null && (
                          <a
                            href={`https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect?cam=2&idp=${r.cdep_idp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info hover:underline"
                          >
                            fișa cdep.ro →
                          </a>
                        )}
                        {r.senat_code && senatUrl(r.senat_code) && (
                          <a
                            href={senatUrl(r.senat_code)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info hover:underline"
                          >
                            fișa senat.ro →
                          </a>
                        )}
                      </span>
                      {r.law_category && (
                        <span className="lg:hidden inline-flex mt-1">
                          <CategoryBadge
                            category={r.law_category}
                            className="text-[10px] px-1.5 py-px rounded"
                            href={buildUrl({ categorie: r.law_category })}
                          />
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top hidden lg:table-cell">
                      {r.law_category
                        ? <CategoryBadge category={r.law_category} href={buildUrl({ categorie: r.law_category })} />
                        : <span className="text-faint text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-faint max-w-2xl">
        Surse: registrul PL-x al Camerei Deputaților (cdep.ro) și registrul L al Senatului
        (senat.ro), actualizate zilnic. „Fără vot în plen" înseamnă inițiative aflate în lucru
        la prima cameră sesizată, înainte de orice vot sau adoptare tacită în plen; adoptarea
        tacită nu apare în acest filtru pentru că proiectul a mers mai departe fără vot.
        „Zile de la depunere" curge de la înregistrarea inițiativei; „zile fără raport" de când
        proiectul e la comisia sesizată în fond — două termene diferite. Timpul petrecut în
        comisie nu implică prin sine rea-voință: termenele depind de complexitate, avize și
        sesiunile parlamentare.{' '}
        <Link href="/despre#metodologie-initiative" className="text-info hover:underline">
          Metodologia completă →
        </Link>
      </p>
    </div>
  )
}
