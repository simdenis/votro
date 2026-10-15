import type { LawExplainer as LawExplainerData } from '@/lib/types'

/** «Pe înțelesul tuturor» — the plain-language explainer (scraper/law_explainer.py,
 *  migration 059). Read from the FINAL law text, so unlike the AiSummary it
 *  describes the law as promulgated, not the initiator's draft. Shown: a
 *  concrete title and a 2–3 sentence summary; the before/now detail and what
 *  the documents leave unclear sit behind «Detalii». Same credibility rules as
 *  AiSummary: tagged as generated, one-click report, the official PDF linked. */

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
  const details = data.ce_se_schimba.length > 0 || data.neclar

  return (
    <section aria-labelledby="pe-intelesul-tuturor" className="bg-surface border border-rim rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <h2 id="pe-intelesul-tuturor" className="text-[11px] font-semibold uppercase tracking-widest text-muted">Pe înțelesul tuturor</h2>
        <span
          className="text-[9px] uppercase tracking-wide font-semibold text-muted bg-raised border border-rim rounded px-1.5 py-px"
          title="Text generat automat dintr-un model AI pe baza textului oficial al legii. Poate conține erori — verifică sursa."
        >
          generat automat · poate conține erori
        </span>
      </div>

      <p className="font-serif text-[21px] leading-snug text-foreground text-balance">{data.titlu}</p>
      {data.rezumat && <p className="mt-2.5 text-[16px] leading-relaxed text-foreground max-w-[65ch]">{data.rezumat}</p>}

      <p className="mt-3 text-[13px] text-muted max-w-[65ch]">
        <span className="font-semibold text-foreground">Afectează:</span> {data.pe_cine_afecteaza}
        {data.de_cand && (
          <>
            {' · '}
            <span className="font-semibold text-foreground">Se aplică:</span> {data.de_cand}
          </>
        )}
      </p>

      {details && (
        <details className="mt-3 group">
          <summary className="cursor-pointer select-none text-[13px] text-muted hover:text-foreground w-fit">
            Detalii: ce era înainte și ce e acum
          </summary>
          <ul className="mt-3 space-y-3 border-l-2 border-rim pl-4">
            {data.ce_se_schimba.map((c, i) => (
              <li key={i} className="text-[14px] leading-relaxed">
                {c.inainte && <p className="text-muted"><span className="font-semibold">Înainte:</span> {c.inainte}</p>}
                <p className="text-foreground"><span className="font-semibold">Acum:</span> {c.acum}</p>
              </li>
            ))}
          </ul>
          {data.neclar && (
            <p className="mt-3 text-[13px] text-muted max-w-[65ch]"><span className="font-semibold">Ce nu reiese din documente:</span> {data.neclar}</p>
          )}
        </details>
      )}

      <div className="mt-4 pt-3 border-t border-rim flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-faint">
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
