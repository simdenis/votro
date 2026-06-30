import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, choiceLabel, choiceColor, pct } from '@/lib/utils'
import { PartyBadge } from '@/components/party-badge'
import { OutcomeBadge } from '@/components/outcome-badge'
import { LoyaltyMeter } from '@/components/loyalty-meter'
import { CardDownload } from '@/components/card-download'
import type { SenatorStats, VoteHistoryRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://votro.ro'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { data } = await getDB()
    .from('senator_stats')
    .select('name, first_name, party_abbr, total_votes, deviation_pct')
    .eq('politician_id', id)
    .maybeSingle()
  if (!data) return { title: 'Senator' }

  const name    = `${data.first_name} ${data.name}`
  const desc    = `${data.name} (${data.party_abbr}) a votat în ${data.total_votes} ședințe. Rată deviere: ${data.deviation_pct != null ? `${data.deviation_pct.toFixed(1)}%` : '—'}.`
  const ogImage = `${SITE_URL}/api/og/senator?id=${id}`

  return {
    title: `${name} — Fișă senator`,
    description: desc,
    openGraph: { title: `${name} — Fișă senator`, description: desc, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter:    { card: 'summary_large_image', title: `${name} — Fișă senator`, description: desc, images: [ogImage] },
  }
}

export default async function SenatorProfile({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = getDB()

  const [r0, r1, r2] = await Promise.all([
    db.from('senator_stats').select('*').eq('politician_id', id).maybeSingle(),
    db
      .from('politician_votes')
      .select('*, votes!inner(*, laws!inner(*))')
      .eq('politician_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('politician_participation').select('participation_pct').eq('politician_id', id).maybeSingle(),
  ])

  const stats   = r0.data as SenatorStats | null
  const history = r1.data as VoteHistoryRow[] | null
  const participationPct = (r2.data as { participation_pct: number | null } | null)?.participation_pct ?? null

  if (!stats) notFound()

  const total         = stats.total_votes
  const loyaltyPct    = stats.deviation_pct != null ? Math.round(100 - stats.deviation_pct) : null
  const isHighDev     = stats.deviation_pct != null && stats.deviation_pct > 10

  const behaviorRows = [
    { label: 'Pentru',    value: stats.votes_for,         color: '#16a34a', icon: '▲' },
    { label: 'Împotrivă', value: stats.votes_against,     color: '#dc2626', icon: '▼' },
    { label: 'Abțineri',  value: stats.votes_abstention,  color: '#8888cc', icon: '—' },
    { label: 'Absent',    value: stats.votes_absent,      color: 'var(--faint)', icon: '·' },
  ]

  const deviations = history?.filter(r => r.party_line_deviation) ?? []

  return (
    <div className="space-y-5">

      {/* ── Header card ─────────────────────────────────── */}
      <div
        className="bg-surface border border-rim rounded-xl p-4 flex items-center gap-4"
        style={{ borderLeftWidth: 4, borderLeftColor: stats.party_color }}
      >
        {/* Avatar */}
        <div className="w-11 h-11 rounded-lg bg-raised border border-rim flex items-center justify-center text-base font-extrabold text-muted flex-shrink-0 select-none">
          {stats.first_name?.[0]}{stats.name?.[0]}
        </div>

        {/* Name + party */}
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-[28px] font-normal text-foreground tracking-[-0.01em] leading-[1.1]">
            {stats.first_name} {stats.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PartyBadge abbreviation={stats.party_abbr} color={stats.party_color} size="md" />
            <span className="text-[10px] text-faint" title="Partidul din care face parte acum. Voturile sunt atribuite afilierii curente.">afiliere curentă</span>
            <span className="text-xs text-muted">Senat · {total} voturi înregistrate</span>
            {participationPct != null && (
              <span className="text-xs text-muted" title="Voturi active împărțite la voturile din Senat din perioada activă. Estimativ — istoricul nostru e parțial.">
                · participare ~{participationPct}% <span className="text-faint">(est.)</span>
              </span>
            )}
          </div>
        </div>

        {/* Loyalty meter */}
        {loyaltyPct != null && (
          <div className="flex-shrink-0">
            <LoyaltyMeter loyaltyPct={loyaltyPct} size={96} />
          </div>
        )}
      </div>

      {/* Download card */}
      <div className="flex">
        <CardDownload href={`/api/og/senatorcard?id=${id}`} filename={`votro-${stats.first_name}-${stats.name}.png`.replace(/\s+/g, '-')} />
      </div>

      {/* ── Two-column analytics ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Voting behavior */}
        <div className="bg-surface border border-rim rounded-xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Comportament vot
          </h2>
          <div className="space-y-2.5">
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

        {/* Deviation log */}
        <div className="bg-surface border border-rim rounded-xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">
            Devieri de la linia de partid
          </h2>
          <p className="text-sm mb-3">
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
            <div className="space-y-2">
              {deviations.slice(0, 8).map(row => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-deviere flex-shrink-0" />
                  <Link
                    href={`/votes/${row.vote_id}`}
                    className="font-mono text-xs text-muted hover:text-foreground transition-colors w-20 flex-shrink-0"
                  >
                    {row.votes.laws?.code}
                  </Link>
                  <span className="text-xs text-muted truncate flex-1">{row.votes.laws?.title}</span>
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
        {!history?.length ? (
          <p className="text-sm text-muted">Nu există voturi înregistrate.</p>
        ) : (
          <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
            {history.map(row => (
              <Link
                key={row.id}
                href={`/votes/${row.vote_id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised transition-colors"
                style={row.party_line_deviation ? { backgroundColor: 'oklch(98% 0.02 80)' } : undefined}
              >
                {/* Choice colour stripe */}
                <div
                  className="w-0.5 h-9 rounded-full flex-shrink-0"
                  style={{ backgroundColor: choiceColor(row.vote_choice) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-xs text-muted">{row.votes.laws?.code}</span>
                    <span className="text-[10px] text-faint">{formatDate(row.votes.vote_date)}</span>
                    {row.party_line_deviation && (
                      <span className="text-[10px] bg-deviere/10 text-deviere font-bold rounded px-1.5 py-px">
                        ⚠ deviere
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground truncate">{row.votes.laws?.title}</p>
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
