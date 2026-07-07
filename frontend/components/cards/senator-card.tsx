// 1080×1080 senator/deputy card — same brand language as VoteCard.

import { countNoun } from '@/lib/utils'

export interface RecentVoteRow {
  lawCode: string
  title: string
  choice: 'for' | 'against' | 'abstention' | 'not_voted' | 'absent'
}

export interface SenatorCardData {
  fullName: string
  partyAbbr: string
  partyColor: string
  chamberLabel: 'SENATOR' | 'DEPUTAT'
  year: number
  totalVotes: number
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  votesAbsent: number
  loyaltyPct: number | null
  deviations: number
  deviationPct: number | null
  noLine: boolean // IND / MIN — no party line
  /** bottom section: recent deviations when there are any, else recent votes */
  recentLabel?: string
  recent?: RecentVoteRow[]
}

const C = {
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  for: '#1a7a42',
  against: '#c4362e',
  abstain: '#8a7fb0',
  absentDot: '#d0cfc8',
  absentNum: '#9e9d97',
  hair: '#e6e5e1',
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

function textOn(bg: string) {
  const h = bg.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0a0a14' : '#ffffff'
}

export function SenatorCard({ data }: { data: SenatorCardData }) {
  const cols: { value: number; label: string; color: string }[] = [
    { value: data.votesFor, label: 'pentru', color: C.for },
    { value: data.votesAgainst, label: 'împotrivă', color: C.against },
    { value: data.votesAbstain, label: 'abțineri', color: C.abstain },
    { value: data.votesAbsent, label: 'absent', color: C.absentNum },
  ]
  const seg = (count: number, color: string) =>
    count > 0 ? <div style={{ flexGrow: count, flexShrink: 1, flexBasis: 0, background: color }} /> : null

  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.38 }}>{`${data.chamberLabel} · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '44px 64px 0' }}>
        {/* Name + party */}
        <div style={{ fontFamily: SERIF, fontSize: 60, lineHeight: 1.04, color: C.text, marginBottom: 18, maxHeight: 200, overflow: 'hidden' }}>{data.fullName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 44 }}>
          <div style={{ display: 'flex', background: data.partyColor, color: textOn(data.partyColor), fontSize: 20, fontWeight: 600, padding: '7px 18px', borderRadius: 4 }}>{data.partyAbbr}</div>
          <div style={{ display: 'flex', fontSize: 17, opacity: 0.4 }}>{`${data.totalVotes} ${countNoun(data.totalVotes, 'vot înregistrat', 'voturi înregistrate')}`}</div>
        </div>

        {/* Headline metric */}
        {!data.noLine && data.loyaltyPct != null && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, marginBottom: 40 }}>
            <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 120, lineHeight: 0.9, color: C.navy }}>{`${data.loyaltyPct}%`}</div>
            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 14 }}>
              <div style={{ display: 'flex', fontSize: 19, fontWeight: 500 }}>loialitate față de partid</div>
              <div style={{ display: 'flex', fontSize: 16, opacity: 0.45, marginTop: 4 }}>{`${data.deviations} ${countNoun(data.deviations, 'deviere', 'devieri')} · ${data.deviationPct === 0 && data.deviations > 0 ? '<1' : data.deviationPct ?? 0}% din voturi`}</div>
            </div>
          </div>
        )}

        {/* Behavior bar */}
        <div style={{ display: 'flex', height: 22, borderRadius: 11, overflow: 'hidden', background: C.hair, marginBottom: 26 }}>
          {seg(data.votesFor, C.for)}
          {seg(data.votesAgainst, C.against)}
          {seg(data.votesAbstain, C.abstain)}
          {seg(data.votesAbsent, C.absentDot)}
        </div>

        {/* 4-col breakdown */}
        <div style={{ display: 'flex' }}>
          {cols.map((c, i) => (
            <div key={c.label} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 20px', borderLeftWidth: i > 0 ? 1 : 0, borderLeftStyle: 'solid', borderLeftColor: C.hair }}>
              <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 44, lineHeight: 1, color: c.color }}>{c.value}</div>
              <div style={{ display: 'flex', fontSize: 12, opacity: 0.3, textTransform: 'uppercase', letterSpacing: 2.5, marginTop: 6 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Recent deviations / votes */}
        {(data.recent?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 42 }}>
            <div style={{ display: 'flex', fontSize: 13, opacity: 0.32, textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 14 }}>
              {data.recentLabel ?? 'Ultimele voturi'}
            </div>
            {data.recent!.slice(0, 3).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', borderTopWidth: i > 0 ? 1 : 0, borderTopStyle: 'solid', borderTopColor: C.hair }}>
                <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: C.navy, minWidth: 118 }}>{r.lawCode}</div>
                <div style={{ display: 'flex', flex: 1, fontSize: 15, opacity: 0.62 }}>
                  {r.title.length > 64 ? r.title.slice(0, 64) + '…' : r.title}
                </div>
                <div style={{
                  display: 'flex', fontSize: 13, fontWeight: 700,
                  color: r.choice === 'for' ? C.for : r.choice === 'against' ? C.against : r.choice === 'abstention' ? C.abstain : C.absentNum,
                }}>
                  {r.choice === 'for' ? 'PENTRU' : r.choice === 'against' ? 'ÎMPOTRIVĂ' : r.choice === 'abstention' ? 'ABȚINERE' : 'ABSENT'}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flex: 1 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, marginTop: 12 }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: C.navy, opacity: 0.62 }}>votro.ro</div>
        <div style={{ display: 'flex', fontSize: 12, opacity: 0.22 }}>voturile sunt atribuite afilierii curente</div>
      </div>
    </div>
  )
}
