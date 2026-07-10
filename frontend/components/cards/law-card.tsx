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
  bg: '#FFFFFF',
  text: '#171A1F',
  navy: '#171A1F',
  for: '#2EA871',
  against: '#EE7B5E',
  abstain: '#E3A23C',
  absentDot: '#D8DBE0',
  hair: '#E7E9EC',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

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

  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 64px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <svg width="46" height="46" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 36, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: '#6E7480' }}>{`LEGE · ${data.year}`}</div>
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
              {/* colored-dot legend with counts — the color key for arc + bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {([
                  [data.votesFor, 'pentru', C.for],
                  [data.votesAgainst, 'împotrivă', C.against],
                  [data.votesAbstain, data.votesAbstain === 1 ? 'abținere' : 'abțineri', C.abstain],
                  [
                    data.parties.reduce((s, p) => s + p.absent, 0) || null,
                    data.parties.reduce((s, p) => s + p.absent, 0) === 1 ? 'absent' : 'absenți',
                    C.absentDot,
                  ],
                ] as const).map(([count, label, color]) =>
                  count != null ? (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', width: 9, height: 9, borderRadius: 5, background: color }} />
                      <div style={{ display: 'flex', fontSize: 12.5, color: '#6E7480' }}>{`${count} ${label}`}</div>
                    </div>
                  ) : null,
                )}
              </div>
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
            const color = s.final && s.done ? C.navy : s.done ? C.for : '#9AA0AA'
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', flexGrow: i === data.journey.length - 1 ? 0 : 1, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: s.final ? 700 : 600, letterSpacing: 1.5, textTransform: 'uppercase', color }}>
                  {s.label}
                  {s.done ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 4, background: '#D8DBE0' }} />
                  )}
                </div>
                {i < data.journey.length - 1 && (
                  <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 1, background: '#D8DBE0', margin: '0 16px' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, marginTop: 18 }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
        <div style={{ display: 'flex', fontSize: 12, color: C.text, opacity: 0.55 }}>sursă: cdep.ro / senat.ro</div>
      </div>
    </div>
  )
}
