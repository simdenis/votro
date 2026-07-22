import { pct, countNoun, hasPartyLine, loyaltyParts , personSlug } from '@/lib/utils'
import { PartyBadge } from '@/components/party-badge'
import { LoyaltyMeter } from '@/components/loyalty-meter'
import { ShareButtons } from '@/components/share-buttons'
import { CardDownload } from '@/components/card-download'
import { PartyHistory } from '@/components/party-history'
import { ReportMistake } from '@/components/report-mistake'
import { FollowButton } from '@/components/follow-button'
import { VoteHistory } from '@/components/vote-history'
import { DeviationList } from '@/components/deviation-list'
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
  // IND/MIN have no party line — loyalty/deviation framing would be meaningless
  const noLine     = !hasPartyLine(stats.party_abbr)
  const parts      = loyaltyParts(stats)
  const loyalty    = noLine ? null : parts.loyaltyPct
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

  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: `${stats.first_name} ${stats.name}`,
    url: `${siteUrl}${basePath}/${personSlug(stats.first_name, stats.name)}`,
    jobTitle: chamberLabel === 'Senat' ? 'Senator' : 'Deputat',
    memberOf: { '@type': 'Organization', name: stats.party_name ?? stats.party_abbr },
    worksFor: { '@type': 'Organization', name: 'Parlamentul României' },
  }

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />

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

        {loyalty != null && (
          <div
            className="flex-shrink-0 flex flex-col items-center"
            title={`A votat la fel ca partidul la ${parts.withParty} din ${parts.expressed} voturi exprimate. Prezența e o metrică separată (vezi „absență").`}
          >
            <LoyaltyMeter loyaltyPct={loyalty} size={112} />
            <span className="text-[11px] text-faint tabular-nums mt-1.5">
              {parts.withParty}/{parts.expressed} exprimate
            </span>
          </div>
        )}
      </div>

      {/* ── Context note + contest path ──────────────────────
          Absence numbers have no defense mechanism on their own: a documented
          concediu medical / delegație reads as truancy. Show the curator note
          when we have one, and always offer a contest path. */}
      {stats.context_note && (
        <div className="bg-surface border border-rim rounded-xl px-4 py-3 flex items-start gap-2.5">
          <span className="text-muted text-sm leading-none mt-0.5" aria-hidden>ⓘ</span>
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-medium text-foreground">Context absențe:</span> {stats.context_note}
            {stats.context_note_url && (
              <>
                {' '}
                <a href={stats.context_note_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">sursă</a>
              </>
            )}
          </p>
        </div>
      )}
      {/* follow + always offer the contest path */}
      <div className="flex items-center gap-3 flex-wrap">
        <FollowButton targetType="politician" targetId={stats.politician_id} what="acest parlamentar" />
        <ReportMistake context={{ parlamentar: `${stats.first_name} ${stats.name}`, pagina: personLd.url }} />
      </div>

      {/* Share row */}
      <div className="flex items-center gap-3 flex-wrap">
        <ShareButtons
          url={`${siteUrl}${basePath}/${personSlug(stats.first_name, stats.name)}`}
          tweet={noLine || loyalty == null
            ? `Cum votează ${stats.first_name} ${stats.name} în Parlament: ${siteUrl}${basePath}/${personSlug(stats.first_name, stats.name)}`
            : `${stats.first_name} ${stats.name} (${stats.party_abbr}): loialitate ${loyalty}% (${parts.withParty}/${parts.expressed} voturi exprimate)${stats.presence_pct != null ? `, prezență ${Math.round(stats.presence_pct)}%` : ''}. ${siteUrl}${basePath}/${personSlug(stats.first_name, stats.name)}`}
        />
        <CardDownload href={`/api/og/senatorcard?id=${stats.politician_id}`} filename={`labutoane-${stats.first_name}-${stats.name}.png`.replace(/\s+/g, '-')} />
        <a
          href={`mailto:siminiucdenis@gmail.com?subject=${encodeURIComponent(`Contestație date — ${stats.first_name} ${stats.name}`)}&body=${encodeURIComponent(`Pagină: ${siteUrl}${basePath}/${personSlug(stats.first_name, stats.name)}\n\nCe date consider greșite (ex. absență justificată prin concediu medical / delegație) și sursa:\n`)}`}
          className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
          title="Semnalează o eroare sau o absență justificată. Verificăm și, dacă e cazul, adăugăm o notă de context."
        >
          Datele sunt greșite? Contestă
        </a>
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
            <DeviationList rows={deviations} total={stats.deviations} />
          )}
          </>)}
        </div>
      </div>

      {/* ── Party switches (renders only for genuine switchers) ── */}
      {partyHistory && <PartyHistory history={partyHistory} currentParty={stats.party_abbr} />}

      {/* ── Vote history timeline ────────────────────────── */}
      <VoteHistory rows={history} />
    </div>
  )
}
