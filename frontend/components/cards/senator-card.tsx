// 1080×1350 (4:5) senator/deputy card — same brand language as VoteCard.

import { countNoun } from '@/lib/utils'

export interface RecentVoteRow {
  lawCode: string
  /** DD.MM.YYYY */
  date: string | null
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
  bg: '#FFFFFF',
  text: '#171A1F',
  navy: '#171A1F',
  for: '#2EA871',
  against: '#EE7B5E',
  abstain: '#E3A23C',
  absentDot: '#D8DBE0',
  absentNum: '#6E7480',
  hair: '#E7E9EC',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

function textOn(bg: string) {
  const h = bg.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#171A1F' : '#ffffff'
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
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: '#6E7480' }}>{`${data.chamberLabel} · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      {/* justifyContent center — at 4:5 the content block floats mid-card */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '20px 64px' }}>
        {/* Name + party */}
        <div style={{ fontFamily: SERIF, fontSize: 60, lineHeight: 1.04, color: C.text, marginBottom: 18, maxHeight: 200, overflow: 'hidden' }}>{data.fullName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 44 }}>
          <div style={{ display: 'flex', background: data.partyColor, color: textOn(data.partyColor), fontSize: 20, fontWeight: 600, padding: '7px 18px', borderRadius: 4 }}>{data.partyAbbr}</div>
          <div style={{ display: 'flex', fontSize: 17, opacity: 0.4 }}>{`a votat la ${data.votesFor + data.votesAgainst + data.votesAbstain} din ${data.totalVotes} ${countNoun(data.totalVotes, 'vot de plen', 'voturi de plen')}`}</div>
        </div>

        {/* Headline metric */}
        {!data.noLine && data.loyaltyPct != null && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, marginBottom: 40 }}>
            <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 120, lineHeight: 0.9, color: C.navy }}>{`${data.loyaltyPct}%`}</div>
            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 14 }}>
              <div style={{ display: 'flex', fontSize: 19, fontWeight: 500 }}>a votat cu partidul, din voturile exprimate</div>
              <div style={{ display: 'flex', fontSize: 16, opacity: 0.7, marginTop: 4 }}>{`${data.deviations} ${countNoun(data.deviations, 'deviere', 'devieri')} · ${data.deviationPct === 0 && data.deviations > 0 ? '<1' : data.deviationPct ?? 0}% din voturile exprimate`}</div>
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
            <div style={{ display: 'flex', fontSize: 13, opacity: 0.72, textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 14 }}>
              {data.recentLabel ?? 'Ultimele voturi'}
            </div>
            {data.recent!.slice(0, 3).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', borderTopWidth: i > 0 ? 1 : 0, borderTopStyle: 'solid', borderTopColor: C.hair }}>
                <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: C.navy, minWidth: 118 }}>{r.lawCode}</div>
                {r.date && <div style={{ display: 'flex', fontSize: 13, opacity: 0.45, minWidth: 84 }}>{r.date}</div>}
                <div style={{ display: 'flex', flex: 1, fontSize: 15, opacity: 0.62 }}>
                  {r.title.length > 56 ? r.title.slice(0, 56) + '…' : r.title}
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
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: '#6E7480' }}>voturile sunt atribuite afilierii curente</div>
        </div>
        {/* logo lives bottom-right — the IG profile picture already brands the top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
      </div>
    </div>
  )
}
