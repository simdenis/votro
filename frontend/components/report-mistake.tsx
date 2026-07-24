// "Raportează o greșeală" — a link to the external report form (Tally), with
// the page's context pre-filled so a report arrives already tagged (which MP,
// which law) instead of "something's wrong somewhere". Part of the correctness/
// contestă posture: publishing names + figures is defensible when there's a
// visible, easy way to flag an error.
//
// Config: NEXT_PUBLIC_REPORT_FORM_URL (the Tally form URL). Unset → nothing
// renders, so the site is safe to ship before the form exists.

const FORM = process.env.NEXT_PUBLIC_REPORT_FORM_URL

export function ReportMistake({
  context = {},
  variant = 'inline',
  className = '',
  label = 'Raportează o greșeală',
}: {
  /** Tally URL pre-fill params, e.g. { parlamentar: 'Felix Stroe', pagina: '…' } */
  context?: Record<string, string>
  variant?: 'inline' | 'button'
  className?: string
  label?: string
}) {
  if (!FORM) return null
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(context).filter(([, v]) => v)),
  ).toString()
  const href = qs ? `${FORM}?${qs}` : FORM

  const base = variant === 'button'
    ? 'inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border border-rim text-muted hover:text-foreground hover:bg-raised transition-colors'
    : 'inline-flex items-center gap-1 text-[12px] text-muted hover:text-foreground underline underline-offset-2 transition-colors'

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${base} ${className}`}>
      <span aria-hidden>⚠</span> {label}
    </a>
  )
}
