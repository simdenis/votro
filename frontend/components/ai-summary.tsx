import { plainSummary } from '@/lib/utils'
import type { SummarySource } from '@/lib/types'

/** "Pe scurt" summary box. AI summaries are the site's biggest credibility
 *  risk — a single wrong one hands a comms person "site-ul ăsta inventează".
 *  So every AI summary is explicitly tagged "generat automat" and carries a
 *  one-click report link. Rendered on both the law page and the vote page.
 *
 *  v2 (migration 054): two labeled sections — the neutral mechanical
 *  description ("Ce face proiectul") and the sponsors' stated justification
 *  ("Motivarea inițiatorilor", quoted from the expunere, shown only when
 *  present). Pre-v2 rows have no motivare/summary_source and render as a
 *  single block, same as before. */
export function AiSummary({
  summary,
  isAi,
  emUrl,
  code,
  motivare,
  summarySource,
  billPdfUrl,
}: {
  summary: string
  isAi: boolean
  emUrl?: string | null
  /** Law code, used in the error-report subject so we know what to check. */
  code?: string | null
  /** Initiators' stated justification (v2 summaries only). */
  motivare?: string | null
  /** What the model actually read; 'title' gets an explicit badge. */
  summarySource?: SummarySource | null
  /** senat.ro bill-text PDF (forma inițiatorului). */
  billPdfUrl?: string | null
}) {
  const text = plainSummary(summary)
  const titleOnly = summarySource === 'title'
  const reportHref =
    `mailto:siminiucdenis@gmail.com?subject=${encodeURIComponent(`Eroare rezumat — ${code ?? 'lege'}`)}` +
    `&body=${encodeURIComponent(`Rezumatul afișat:\n„${text}"\n\nCe e greșit / imprecis:\n`)}`

  return (
    <div className="relative bg-surface border border-rim rounded-xl p-5 pl-6 overflow-hidden">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-sidebar" />
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          {motivare ? 'Ce face proiectul' : 'Pe scurt'}
        </p>
        {isAi && (
          <span
            className="text-[9px] uppercase tracking-wide font-semibold text-muted bg-raised border border-rim rounded px-1.5 py-px"
            title="Text generat automat dintr-un model AI pe baza documentelor oficiale ale proiectului. Poate conține erori — verifică sursa."
          >
            generat automat · poate conține erori
          </span>
        )}
        {titleOnly && (
          <span
            className="text-[9px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-500 bg-raised border border-rim rounded px-1.5 py-px"
            title="Documentele oficiale (textul proiectului, expunerea de motive) nu au putut fi citite — rezumatul reflectă doar titlul oficial."
          >
            rezumat generat doar din titlu
          </span>
        )}
      </div>
      <p className="text-[15px] text-foreground leading-relaxed">{text}</p>
      {motivare && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mt-4 mb-2">
            Motivarea inițiatorilor
          </p>
          {/* the sponsors' own case for the bill, quoted from the expunere de
              motive — attributed claims, not the site's assessment */}
          <p className="text-[15px] text-foreground leading-relaxed">{plainSummary(motivare)}</p>
        </>
      )}
      {isAi && (
        // frames time-relative statements ("amână până la 1 ian 2026") as the
        // proposal's original intent, so an old summary doesn't read as a
        // current claim about the promulgated law
        <p className="text-[11px] text-faint mt-1.5 italic">
          Rezumă forma inițială a proiectului, nu neapărat legea promulgată. Datele și cifrele
          menționate pot fi depășite; textul oficial e în PDF.
        </p>
      )}
      <div className="mt-3.5 pt-3 border-t border-rim flex items-center justify-between gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-faint">
        <div className="flex items-center gap-3 flex-wrap">
          {isAi && (
            <a href={reportHref} className="hover:text-foreground underline underline-offset-2">
              Raportează o eroare
            </a>
          )}
          {billPdfUrl && (
            <a href={billPdfUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-2">
              Sursa: textul proiectului (PDF)
            </a>
          )}
          {emUrl && (
            <a href={emUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-2">
              Sursa: expunerea de motive (PDF)
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
