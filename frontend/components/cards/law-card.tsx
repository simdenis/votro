// 1080×1080 law-journey card — same brand language as VoteCard.

import type { PartyVote } from './vote-card'
import { computeArcDots } from './vote-card'

export interface JourneyStep { label: string; done: boolean; final?: boolean }

export interface LawCardData {
  lawCode: string
  lawTitle: string
  category: string | null
  year: number
  statusLabel: string   // "PROMULGATĂ", "ADOPTATĂ", "ÎN DEZBATERE", "RESPINSĂ"
  statusColor: string
  dateLine: string | null // e.g. "Promulgată · 24 mai 2026"
  journey: JourneyStep[]
  // Decisive plenary vote (Camera if voted there, else Senat) — optional
  voteChamber: 'CAMERA DEPUTAȚILOR' | 'SENAT' | null
  votesFor: number | null
  votesAgainst: number | null
  votesAbstain: number | null
  parties: PartyVote[]
}

const C = {
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  for: '#1a7a42',
  against: '#c4362e',
  abstain: '#8a7fb0',
  absentDot: '#d0cfc8',
  hair: '#e6e5e1',
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

/** Shrink the serif title as it grows so it always fits — never clip it. */
function titleFont(len: number): number {
  if (len <= 70) return 50
  if (len <= 120) return 42
  if (len <= 180) return 37
  if (len <= 260) return 32
  if (len <= 360) return 28
  if (len <= 500) return 24
  return 20
}

export function LawCard({ data }: { data: LawCardData }) {
  const seg = (count: number, color: string) =>
    count > 0 ? <div style={{ flexGrow: count, flexShrink: 1, flexBasis: 0, background: color }} /> : null

  const voteCounts = [
    data.votesFor != null ? `${data.votesFor} pentru` : null,
    data.votesAgainst != null ? `${data.votesAgainst} împotrivă` : null,
    data.votesAbstain != null ? `${data.votesAbstain} ${data.votesAbstain === 1 ? 'abținere' : 'abțineri'}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', color: C.text, opacity: 0.55 }}>{`LEGE · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '40px 64px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', fontSize: 15, fontWeight: 500, color: C.navy, letterSpacing: 4, textTransform: 'uppercase' }}>{data.lawCode}</div>
          {data.category && (
            <div style={{ display: 'flex', fontSize: 13, color: C.text, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1.5 }}>{data.category}</div>
          )}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: titleFont(data.lawTitle.length), lineHeight: 1.14, color: C.text, marginBottom: 28 }}>{data.lawTitle}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ display: 'flex', background: data.statusColor, color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3 }}>
            {data.statusLabel}
          </div>
          {data.dateLine && <div style={{ display: 'flex', fontSize: 17, color: C.text, opacity: 0.8 }}>{data.dateLine}</div>}
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 10 }} />

        {/* Parliament arc — the decisive plenary vote, as a semicircle */}
        {data.voteChamber && (data.votesFor != null || data.votesAgainst != null) && (() => {
          const f = data.votesFor ?? 0, a = data.votesAgainst ?? 0, ab = data.votesAbstain ?? 0
          const absent = data.parties.reduce((s, p) => s + p.absent, 0)
          const dots = computeArcDots(f, a, ab, 0, absent)
          const arcH = data.lawTitle.length > 220 || data.parties.length > 6 ? 210 : 268
          const arcW = Math.round(952 * (arcH / 308))
          return (
            <div style={{ display: 'flex', width: '100%', height: arcH, justifyContent: 'center', marginBottom: 12 }}>
              <svg width={arcW} height={arcH} viewBox="0 0 952 308">
                {dots.map((d, i) => (
                  <circle key={i} cx={d.x} cy={d.y} r={4.5} fill={d.color} />
                ))}
              </svg>
            </div>
          )
        })()}

        {/* Party vote — decisive plenary vote */}
        {data.parties.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
            <div style={{ display: 'flex', height: 1, background: C.hair, marginBottom: 14 }} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', fontSize: 11, fontWeight: 600, color: C.navy, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.85 }}>
                {`Vot pe partide${data.voteChamber ? ` · ${data.voteChamber}` : ''}`}
              </div>
              {voteCounts && <div style={{ display: 'flex', fontSize: 13, color: C.text, opacity: 0.7 }}>{voteCounts}</div>}
            </div>
            {(() => {
              const n = data.parties.length
              const rowH = n > 8 ? 26 : n > 6 ? 30 : n > 5 ? 33 : 36
              const barH = rowH < 32 ? 11 : 14
              return data.parties.map(p => {
                const t = p.for + p.against + p.abstain + p.absent
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', height: rowH }}>
                    <div style={{ display: 'flex', width: 62, justifyContent: 'flex-end', fontSize: 13, fontWeight: 600, color: C.text, opacity: 0.75, paddingRight: 10 }}>{p.name}</div>
                    <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, height: barH, borderRadius: 2, overflow: 'hidden', background: C.hair }}>
                      {seg(p.for, C.for)}
                      {seg(p.against, C.against)}
                      {seg(p.abstain, C.abstain)}
                      {seg(p.absent, C.absentDot)}
                    </div>
                    <div style={{ display: 'flex', width: 34, fontSize: 11, color: C.text, opacity: 0.8, paddingLeft: 8 }}>{t}</div>
                  </div>
                )
              })
            })()}
          </div>
        )}

        {/* Legislative journey */}
        <div style={{ display: 'flex', height: 1, background: C.hair, marginBottom: 22 }} />
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          {data.journey.map((s, i) => {
            const color = s.final && s.done ? C.navy : s.done ? C.for : '#b9b8b2'
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', flexGrow: i === data.journey.length - 1 ? 0 : 1, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: s.final ? 700 : 600, letterSpacing: 1.5, textTransform: 'uppercase', color }}>
                  {s.label}
                  {s.done ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 4, background: '#c9c8c2' }} />
                  )}
                </div>
                {i < data.journey.length - 1 && (
                  <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 1, background: '#d6d5cf', margin: '0 16px' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, marginTop: 18 }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: C.navy, opacity: 0.85 }}>@vot.romania</div>
        <div style={{ display: 'flex', fontSize: 12, color: C.text, opacity: 0.55 }}>sursă: cdep.ro / senat.ro</div>
      </div>
    </div>
  )
}
