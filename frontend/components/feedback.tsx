// "Ai o idee?" — general suggestions / feedback, kept separate from error
// reporting (ReportMistake) so the two intents don't blur. Uses a Tally form
// when NEXT_PUBLIC_FEEDBACK_FORM_URL is set; otherwise falls back to email, so
// it's always live — configuring Tally just upgrades it in place.

const FORM = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL
const MAILTO = 'mailto:siminiucdenis@gmail.com?subject=Sugestie%20LaButoane'

export function Feedback({
  variant = 'inline',
  className = '',
  label = 'Ai o idee?',
}: {
  variant?: 'inline' | 'button'
  className?: string
  label?: string
}) {
  const href = FORM || MAILTO

  const base = variant === 'button'
    ? 'inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-md border border-rim text-foreground hover:bg-surface transition-colors'
    : 'inline-flex items-center gap-1 text-[12px] text-muted hover:text-foreground underline underline-offset-2 transition-colors'

  // external Tally form opens in a new tab; a mailto should not
  const external = Boolean(FORM)

  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${base} ${className}`}
    >
      <span aria-hidden>💡</span> {label}
    </a>
  )
}
