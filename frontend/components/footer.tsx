import Link from 'next/link'
import { getDB } from '@/lib/supabase'
import { formatRelativeTime, recessUntil } from '@/lib/utils'
import { ReportMistake } from '@/components/report-mistake'

async function LastUpdated() {
  // Two different freshness facts: when the pipeline last ran successfully
  // (heartbeat — warn if THAT is stale) vs when parliament last produced a
  // vote (recess is normal, never a warning).
  const db = getDB()
  const [meta, vote] = await Promise.all([
    db.from('scrape_meta').select('value').eq('key', 'last_scrape_at').maybeSingle(),
    db.from('votes').select('vote_date').order('vote_date', { ascending: false }).limit(1),
  ])
  const checkedAt = meta.data?.value as string | undefined
  const lastVote  = vote.data?.[0]?.vote_date as string | undefined
  if (!checkedAt) return <span>Actualizat zilnic</span>
  // A week-old "last vote" reads as a dead site when it's really just recess
  const quiet  = lastVote && Date.now() - new Date(lastVote).getTime() > 7 * 86_400_000
  const recess = quiet ? recessUntil() : null
  // The ⚠ means OUR pipeline broke, not that parliament is quiet. During recess
  // the scrape cron runs less often, so a 2-day heartbeat gap is expected — only
  // flag it as broken past a week (long enough to miss an extraordinary session).
  const heartbeatAge = Date.now() - new Date(checkedAt).getTime()
  const stale = heartbeatAge > (recess ? 8 * 86_400_000 : 36 * 3_600_000)
  return (
    <span className={stale ? 'text-deviere' : ''}>
      {recess
        ? `Sesiune închisă până la ${recess}${lastVote ? ` · ultimul vot ${formatRelativeTime(lastVote)}` : ''}`
        : `${lastVote ? `Ultimul vot: ${formatRelativeTime(lastVote)} · ` : ''}Verificat ${formatRelativeTime(checkedAt)}`}
      {stale ? (
        <span title="Actualizarea automată pare întârziată — verificăm sursele. Nu e o eroare a datelor afișate." aria-label="actualizare automată întârziată">
          {' '}⚠
        </span>
      ) : null}
    </span>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-rim mt-16">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
        <span>
          LaButoane · Date din surse publice:{' '}
          <a href="https://senat.ro" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">senat.ro</a>
          {' · '}
          <a href="https://cdep.ro" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">cdep.ro</a>
        </span>
        <span className="flex items-center gap-3">
          <LastUpdated />
          <span className="text-faint">·</span>
          <Link href="/despre" className="hover:text-foreground">Despre</Link>
          <span className="text-faint">·</span>
          <Link href="/date" className="hover:text-foreground">Date deschise</Link>
          <span className="text-faint">·</span>
          <Link href="/confidentialitate" className="hover:text-foreground">Confidențialitate</Link>
          <span className="text-faint">·</span>
          <Link href="/contribuie" className="hover:text-foreground">Contribuie</Link>
          <span className="text-faint">·</span>
          <ReportMistake />
          <span className="text-faint">·</span>
          <span>Neafiliat politic</span>
        </span>
      </div>
    </footer>
  )
}
