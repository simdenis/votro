import Link from 'next/link'
import { getDB } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/utils'

async function LastUpdated() {
  const { data } = await getDB()
    .from('votes')
    .select('scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(1)
  const ts = data?.[0]?.scraped_at as string | undefined
  if (!ts) return <span>Actualizat zilnic</span>
  const stale = Date.now() - new Date(ts).getTime() > 48 * 3_600_000
  return (
    <span className={stale ? 'text-deviere' : ''}>
      Actualizat {formatRelativeTime(ts)}{stale ? ' ⚠' : ''}
    </span>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-rim mt-16">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
        <span>
          VotRO · Date din surse publice:{' '}
          <a href="https://senat.ro" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">senat.ro</a>
          {' · '}
          <a href="https://cdep.ro" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">cdep.ro</a>
        </span>
        <span className="flex items-center gap-3">
          <LastUpdated />
          <span className="text-faint">·</span>
          <Link href="/despre" className="hover:text-foreground">Despre</Link>
          <span className="text-faint">·</span>
          <Link href="/contribuie" className="hover:text-foreground">Contribuie</Link>
          <span className="text-faint">·</span>
          <span>Neafiliat politic</span>
        </span>
      </div>
    </footer>
  )
}
