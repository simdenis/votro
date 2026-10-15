import type { LawExplainer as LawExplainerData } from '@/lib/types'

/** «Ce se schimbă» — the plain-language explainer (scraper/law_explainer.py,
 *  migration 059). Read from the FINAL law text, so unlike the AiSummary it
 *  describes the law as promulgated, not the initiator's draft. Same
 *  credibility rules as AiSummary: tagged as generated, one-click report,
 *  the official PDF one click away. */

const FORM_LABEL: Record<string, string> = {
  fp: 'forma promulgată',
  lp: 'forma trimisă la promulgare',
  fs: 'forma adoptată de Senat',
  fg: 'forma inițiatorului',
}
const FORM_SUFFIX: Record<string, string> = { fp: 'FP', lp: 'LP', fs: 'FS', fg: 'FG' }

function senatPdf(code: string, form: string): string | null {
  const m = /^L(\d+)\/(\d{4})$/.exec(code)
  const suffix = FORM_SUFFIX[form]
  if (!m || !suffix) return null
  const [num, year] = [Number(m[1]), Number(m[2])]
  return `https://www.senat.ro/legis/PDF/${year}/${String(year % 100).padStart(2, '0')}L${String(num).padStart(3, '0')}${suffix}.PDF`
}

export function LawExplainer({ data, source, code }: { data: LawExplainerData; source: string | null; code: string }) {
  const form = (source ?? '').split('+')[0]
  const pdf = senatPdf(code, form)
  const reportHref =
    `mailto:siminiucdenis@gmail.com?subject=${encodeURIComponent(`Eroare explicație — ${code}`)}` +
    `&body=${encodeURIComponent(`Explicația afișată:\n„${data.titlu}"\n\nCe e greșit / imprecis:\n`)}`

  return (
    <section aria-labelledby="ce-se-schimba" className="relative bg-surface border border-rim rounded-xl p-5 pl-6 overflow-hidden">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-for)]" />
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h2 id="ce-se-schimba" className="text-[11px] font-semibold uppercase tracking-widest text-muted">Ce se schimbă</h2>
        <span
          className="text-[9px] uppercase tracking-wide font-semibold text-muted bg-raised border border-rim rounded px-1.5 py-px"
          title="Text generat automat dintr-un model AI pe baza textului oficial al legii. Poate conține erori — verifică sursa."
        >
          generat automat · poate conține erori
        </span>
      </div>

      <p className="font-serif text-[22px] leading-snug text-foreground text-balance">{data.titlu}</p>

      <ul className="mt-4 space-y-3">
        {data.ce_se_schimba.map((c, i) => (
          <li key={i} className="text-[15px] leading-relaxed">
            {c.inainte && (
              <p className="text-muted">
                <span className="text-[11px] font-semibold uppercase tracking-wider mr-1.5">Înainte</span>
                {c.inainte}
              </p>
            )}
            <p className="text-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider mr-1.5 text-[var(--color-for-dark)]">Acum</span>
              {c.acum}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="font-semibold text-foreground">Pe cine afectează</dt>
        <dd className="text-muted min-w-0">{data.pe_cine_afecteaza}</dd>
        {data.de_cand && (
          <>
            <dt className="font-semibold text-foreground">De când</dt>
            <dd className="text-muted min-w-0">{data.de_cand}</dd>
          </>
        )}
        {data.neclar && (
          <>
            <dt className="font-semibold text-foreground">Ce nu reiese clar</dt>
            <dd className="text-muted min-w-0">{data.neclar}</dd>
          </>
        )}
      </dl>

      <div className="mt-3.5 pt-3 border-t border-rim flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-faint">
        <a href={reportHref} className="hover:text-foreground underline underline-offset-2">Raportează o eroare</a>
        {pdf && (
          <a href={pdf} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-2">
            {`Sursa: ${FORM_LABEL[form] ?? 'textul legii'} (PDF)`}
          </a>
        )}
      </div>
    </section>
  )
}
