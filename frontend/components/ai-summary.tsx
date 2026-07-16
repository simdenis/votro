/** "Pe scurt" summary box. AI summaries are the site's biggest credibility
 *  risk — a single wrong one hands a comms person "site-ul ăsta inventează".
 *  So every AI summary is explicitly tagged "generat automat" and carries a
 *  one-click report link. Rendered on both the law page and the vote page. */
export function AiSummary({
  summary,
  isAi,
  emUrl,
  code,
}: {
  summary: string
  isAi: boolean
  emUrl?: string | null
  /** Law code, used in the error-report subject so we know what to check. */
  code?: string | null
}) {
  const reportHref =
    `mailto:siminiucdenis@gmail.com?subject=${encodeURIComponent(`Eroare rezumat — ${code ?? 'lege'}`)}` +
    `&body=${encodeURIComponent(`Rezumatul afișat:\n„${summary}"\n\nCe e greșit / imprecis:\n`)}`

  return (
    <div className="relative bg-surface border border-rim rounded-xl p-5 pl-6 overflow-hidden">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-sidebar" />
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Pe scurt</p>
        {isAi && (
          <span
            className="text-[9px] uppercase tracking-wide font-semibold text-muted bg-raised border border-rim rounded px-1.5 py-px"
            title="Text generat automat dintr-un model AI pe baza expunerii de motive. Poate conține erori — verifică sursa."
          >
            generat automat
          </span>
        )}
      </div>
      <p className="text-[15px] text-foreground leading-relaxed">{summary}</p>
      <div className="mt-3.5 pt-3 border-t border-rim flex items-center justify-between gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-faint">
        <div className="flex items-center gap-3 flex-wrap">
          {isAi && (
            <a href={reportHref} className="hover:text-foreground underline underline-offset-2">
              Raportează o eroare
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
