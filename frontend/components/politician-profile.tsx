import Link from 'next/link'
import { formatDate, choiceLabel, choiceColor, pct, countNoun, hasPartyLine, capFirst } from '@/lib/utils'
import { PartyBadge } from '@/components/party-badge'
import { OutcomeBadge } from '@/components/outcome-badge'
import { LoyaltyMeter } from '@/components/loyalty-meter'
import { ShareButtons } from '@/components/share-buttons'
import { CardDownload } from '@/components/card-download'
import { PartyHistory } from '@/components/party-history'
import { trueAbsent, type PoliticianStats, type VoteHistoryRow, type PartyHistoryEntry } from '@/lib/types'

interface Props {
  stats: PoliticianStats
  history: VoteHistoryRow[]
  /** Fetched directly — deviations can be older than the history window. */
  deviationRows?: VoteHistoryRow[]
  /** Party membership periods — the card renders only for actual switchers. */
  partyHistory?: PartyHistoryEntry[]
  basePath: string
  chamberLabel: string
  siteUrl: string
}

export function PoliticianProfile({ stats, history, deviationRows, partyHistory, basePath, chamberLabel, siteUrl }: Props) {
  const total      = stats.total_votes
  const expressed  = stats.votes_for + stats.votes_against + stats.votes_abstention
  // IND/MIN have no party line — loyalty/deviation framing would be meaningless.
  // Below ~100 expressed votes the metric is noise, and worse: the most absent
  // members are exactly the ones who'd flaunt a shiny "100% loyalty" badge.
  const LOYALTY_MIN_VOTES = 100
  const smallSample = expressed < LOYALTY_MIN_VOTES
  const noLine     = !hasPartyLine(stats.party_abbr)
  const loyaltyPct = !noLine && !smallSample && stats.deviation_pct != null ? Math.floor(100 - stats.deviation_pct) : null
  const isHighDev  = stats.deviation_pct != null && stats.deviation_pct > 10

  // Denominator = ALL plenary votes since mandate start, not just recorded
  // rows — the sources rarely list absentees, so recorded 'absent' rows
  // undercount massively (Anisie: 9 recorded vs ~200 real). Falls back to
  // recorded rows if the view predates migration 023.
  const denom      = stats.chamber_votes || total
  const absentReal = trueAbsent(stats) ?? stats.votes_absent
  const notVoted   = stats.votes_not_voted ?? 0
  const behaviorRows = [
    { label: 'Pentru',    value: stats.votes_for,        color: 'var(--color-for)', icon: '▲' },
    { label: 'Împotrivă', value: stats.votes_against,    color: 'var(--color-against)', icon: '▼' },
    { label: 'Abțineri',  value: stats.votes_abstention, color: 'var(--color-abstention)', icon: '—' },
    ...(notVoted > 0
      ? [{ label: 'Prezent, fără vot', value: notVoted, color: 'var(--faint)', icon: '○' }]
      : []),
    { label: 'Absent',    value: absentReal,             color: 'var(--faint)', icon: '·' },
  ]

  const deviations = deviationRows ?? history.filter(r => r.party_line_deviation)

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
          <h1 className="font-serif text-[28px] font-normal text-foreground tracking-[-0.01em] leading-[1.1]">
            {stats.first_name} {stats.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PartyBadge abbreviation={stats.party_abbr} color={stats.party_color} size="md" />
            {stats.gov_role && (
              <span
                className="text-[10px] uppercase font-semibold tracking-wide bg-sidebar text-white rounded-[3px] px-1.5 py-px"
                title="În Guvern în această legislatură (actual sau fost) — în funcție nu votează în plen, deci absența e structurală, nu o alegere."
              >
                guvern · {stats.gov_role}
              </span>
            )}
            <span className="text-[10px] text-faint" title="Partidul din care face parte acum. Voturile sunt atribuite afilierii curente.">afiliere curentă</span>
            <span className="text-xs text-muted">
              {chamberLabel}
              {stats.county && (stats.county === 'Diaspora' ? ' · Diaspora' : ` · ${stats.county}`)}
              {/* "a votat la X din Y" — the raw recorded-rows count made readers
                  reconcile 54 vs 319 themselves */}
              {' · '}a votat la {expressed} din {stats.chamber_votes || total} {countNoun(stats.chamber_votes || total, 'vot de plen', 'voturi de plen')}
            </span>
            {!stats.gov_role && stats.presence_pct != null && (
              <span
                className={`text-xs ${100 - stats.presence_pct > 30 ? 'text-respins font-semibold' : 'text-muted'}`}
                title="Voturi la care a participat, împărțite la toate voturile ținute în camera sa de la validarea mandatului — aceeași metrică din listă."
              >
                · absență {Math.round(100 - stats.presence_pct)}%
              </span>
            )}
          </div>
        </div>

        {loyaltyPct != null && (
          <div className="flex-shrink-0">
            <LoyaltyMeter loyaltyPct={loyaltyPct} size={112} />
          </div>
        )}
        {!noLine && smallSample && (
          <div
            className="flex-shrink-0 w-[112px] text-center text-[11px] text-faint leading-snug"
            title={`Loialitatea se afișează de la ${LOYALTY_MIN_VOTES} de voturi exprimate — sub acest prag procentul e zgomot statistic.`}
          >
            loialitate necalculată
            <br />
            <span className="text-[10px]">(doar {expressed} {countNoun(expressed, 'vot exprimat', 'voturi exprimate')})</span>
          </div>
        )}
      </div>

      {/* Share row */}
      <div className="flex items-center gap-3 flex-wrap">
        <ShareButtons
          url={`${siteUrl}${basePath}/${stats.politician_id}`}
          tweet={noLine || smallSample
            ? `Cum votează ${stats.first_name} ${stats.name} în Parlament: ${siteUrl}${basePath}/${stats.politician_id}`
            : `${stats.first_name} ${stats.name} (${stats.party_abbr}) a deviat de la linia de partid în ${pct(stats.deviation_pct)} din voturi. ${siteUrl}${basePath}/${stats.politician_id}`}
        />
        <CardDownload href={`/api/og/senatorcard?id=${stats.politician_id}`} filename={`labutoane-${stats.first_name}-${stats.name}.png`.replace(/\s+/g, '-')} />
      </div>

      {/* ── Two-column analytics ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-surface border border-rim rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
            Comportament vot
            <span className="normal-case tracking-normal font-normal text-faint"> · din {denom} {countNoun(denom, 'vot de plen', 'voturi de plen')}</span>
          </h2>
          <div className="space-y-3">
            {behaviorRows.map(row => (
              <div key={row.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-muted">{row.icon} {row.label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: row.color }}>
                    {row.value}
                    <span className="text-xs font-normal text-faint ml-1.5">
                      ({denom > 0 ? Math.round((row.value / denom) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${denom > 0 ? (row.value / denom) * 100 : 0}%`, backgroundColor: row.color }}
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
          {noLine ? (
            <p className="text-sm text-faint mt-3">
              {stats.party_abbr === 'MIN' ? 'Grupul minorităților naționale nu are' : 'Neafiliat — nu are'} o
              linie de partid de la care să devieze, deci nu calculăm devieri.
            </p>
          ) : (<>
          <p className="text-sm mb-4">
            <span className={isHighDev ? 'text-deviere font-semibold' : 'text-muted'}>
              {stats.deviations} {countNoun(stats.deviations, 'deviere', 'devieri')}
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
                    href={`/voturi/${row.vote_id}`}
                    className="font-mono text-xs text-muted hover:text-foreground transition-colors w-20 flex-shrink-0"
                  >
                    {row.votes.laws?.code ?? '—'}
                  </Link>
                  <span className="text-xs text-muted truncate flex-1">{capFirst(row.votes.laws?.title ?? row.votes.description ?? '') || 'Vot procedural (fără lege identificată)'}</span>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: choiceColor(row.vote_choice) }}>
                    {choiceLabel(row.vote_choice)}
                  </span>
                </div>
              ))}
            </div>
          )}
          </>)}
        </div>
      </div>

      {/* ── Party switches (renders only for genuine switchers) ── */}
      {partyHistory && <PartyHistory history={partyHistory} currentParty={stats.party_abbr} />}

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
                href={`/voturi/${row.vote_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors"
                style={row.party_line_deviation ? { backgroundColor: 'oklch(98% 0.02 80)' } : undefined}
              >
                <div
                  className="w-0.5 h-9 rounded-full flex-shrink-0"
                  style={{ backgroundColor: choiceColor(row.vote_choice) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-xs text-muted">{row.votes.laws?.code ?? '—'}</span>
                    <span className="text-[10px] text-faint">{formatDate(row.votes.vote_date)}</span>
                    {/* same bill can be voted repeatedly in a day (amendments,
                        procedure, final) — without the stage label, opposite
                        votes on one law read as data corruption */}
                    {row.votes.vote_type && (
                      <span className="text-[10px] uppercase text-faint bg-raised border border-rim rounded px-1.5 py-px">
                        {row.votes.vote_type}
                      </span>
                    )}
                    {row.party_line_deviation && (
                      <span className="text-[10px] bg-deviere/10 text-deviere font-bold rounded px-1.5 py-px">
                        ⚠ deviere
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground truncate">{capFirst(row.votes.laws?.title ?? row.votes.description ?? '') || 'Vot procedural (fără lege identificată)'}</p>
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
