import Link from 'next/link'
import { formatDate, choiceLabel, choiceColor, pct } from '@/lib/utils'
import { PartyBadge } from '@/components/party-badge'
import { OutcomeBadge } from '@/components/outcome-badge'
import { LoyaltyMeter } from '@/components/loyalty-meter'
import { ShareButtons } from '@/components/share-buttons'
import type { PoliticianStats, VoteHistoryRow } from '@/lib/types'

interface Props {
  stats: PoliticianStats
  history: VoteHistoryRow[]
  basePath: string
  chamberLabel: string
  siteUrl: string
}

export function PoliticianProfile({ stats, history, basePath, chamberLabel, siteUrl }: Props) {
  const total      = stats.total_votes
  const loyaltyPct = stats.deviation_pct != null ? Math.round(100 - stats.deviation_pct) : null
  const isHighDev  = stats.deviation_pct != null && stats.deviation_pct > 10

  const behaviorRows = [
    { label: 'Pentru',    value: stats.votes_for,        color: '#16a34a', icon: '▲' },
    { label: 'Împotrivă', value: stats.votes_against,    color: '#dc2626', icon: '▼' },
    { label: 'Abțineri',  value: stats.votes_abstention, color: '#8888cc', icon: '—' },
    { label: 'Absent',    value: stats.votes_absent,     color: 'var(--faint)', icon: '·' },
  ]

  const deviations = history.filter(r => r.party_line_deviation)

  return (
    <div className="space-y-6">

      {/* ── Header card ─────────────────────────────────── */}
      <div
        className="bg-surface border border-rim rounded-xl p-4 flex items-center gap-4"
        style={{ borderLeftWidth: 4, borderLeftColor: stats.party_color }}
      >
        <div className="w-12 h-12 rounded-lg bg-raised border border-rim flex items-center justify-center text-base font-extrabold text-muted flex-shrink-0 select-none">
          {stats.first_name?.[0]}{stats.name?.[0]}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold text-foreground tracking-tight leading-tight">
            {stats.first_name} {stats.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <PartyBadge abbreviation={stats.party_abbr} color={stats.party_color} size="md" />
            <span className="text-xs text-muted">{chamberLabel} · {total} voturi înregistrate</span>
          </div>
        </div>

        {loyaltyPct != null && (
          <div className="flex-shrink-0">
            <LoyaltyMeter loyaltyPct={loyaltyPct} size={112} />
          </div>
        )}
      </div>

      {/* Share row */}
      <ShareButtons
        url={`${siteUrl}${basePath}/${stats.politician_id}`}
        tweet={`${stats.first_name} ${stats.name} (${stats.party_abbr}) a deviat de la linia de partid în ${pct(stats.deviation_pct)} din voturi. ${siteUrl}${basePath}/${stats.politician_id}`}
      />

      {/* ── Two-column analytics ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-surface border border-rim rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
            Comportament vot
          </h2>
          <div className="space-y-3">
            {behaviorRows.map(row => (
              <div key={row.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-muted">{row.icon} {row.label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: row.color }}>
                    {row.value}
                    <span className="text-xs font-normal text-faint ml-1.5">
                      ({total > 0 ? Math.round((row.value / total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${total > 0 ? (row.value / total) * 100 : 0}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-rim rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">
            Devieri de la linia de partid
          </h2>
          <p className="text-sm mb-4">
            <span className={isHighDev ? 'text-deviere font-semibold' : 'text-muted'}>
              {stats.deviations} devieri
            </span>
            <span className="text-faint mx-1.5">·</span>
            <span className={isHighDev ? 'text-deviere font-semibold' : 'text-muted'}>
              {pct(stats.deviation_pct)}
            </span>
          </p>
          {deviations.length === 0 ? (
            <p className="text-sm text-faint">Nicio deviere înregistrată.</p>
          ) : (
            <div className="space-y-2.5">
              {deviations.slice(0, 8).map(row => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-deviere flex-shrink-0" />
                  <Link
                    href={`/votes/${row.vote_id}`}
                    className="font-mono text-xs text-muted hover:text-foreground transition-colors w-20 flex-shrink-0"
                  >
                    {row.votes.laws.code}
                  </Link>
                  <span className="text-xs text-muted truncate flex-1">{row.votes.laws.title}</span>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: choiceColor(row.vote_choice) }}>
                    {choiceLabel(row.vote_choice)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Vote history timeline ────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          Activitate recentă
        </h2>
        {!history.length ? (
          <p className="text-sm text-muted">Nu există voturi înregistrate.</p>
        ) : (
          <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
            {history.map(row => (
              <Link
                key={row.id}
                href={`/votes/${row.vote_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors"
                style={row.party_line_deviation ? { backgroundColor: 'oklch(98% 0.02 80)' } : undefined}
              >
                <div
                  className="w-0.5 h-9 rounded-full flex-shrink-0"
                  style={{ backgroundColor: choiceColor(row.vote_choice) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-xs text-muted">{row.votes.laws.code}</span>
                    <span className="text-[10px] text-faint">{formatDate(row.votes.vote_date)}</span>
                    {row.party_line_deviation && (
                      <span className="text-[10px] bg-deviere/10 text-deviere font-bold rounded px-1.5 py-px">
                        ⚠ deviere
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground truncate">{row.votes.laws.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold" style={{ color: choiceColor(row.vote_choice) }}>
                    {choiceLabel(row.vote_choice)}
                  </span>
                  <OutcomeBadge outcome={row.votes.outcome} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
