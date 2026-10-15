// 1080×1350 (4:5) law-journey card — same brand language as VoteCard.

import type { PartyVote } from './vote-card'
import { computeArcDots } from './vote-card'
import { categoryColor } from '@/lib/category-colors'
import { CardHeader, CardFooter, clip } from './kit'

/** outcome is null when the chamber hasn't voted yet OR its vote comes later
 *  in the carousel than the displayed slide (revealed chronologically). */
export interface JourneyStep { label: string; outcome: 'adoptat' | 'respins' | null; active: boolean }

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
  if (len <= 70) return 56
  if (len <= 120) return 47
  if (len <= 180) return 41
  if (len <= 260) return 36
  return 31  // longer titles are clipped to 260 characters (kit clip)
}

export function LawCard({ data }: { data: LawCardData }) {
  const seg = (count: number, color: string) =>
    count > 0 ? <div style={{ flexGrow: count, flexShrink: 1, flexBasis: 0, background: color }} /> : null

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <CardHeader kicker={`LEGE · ${data.year}`} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '40px 64px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 500, color: C.navy, letterSpacing: 4, textTransform: 'uppercase' }}>{data.lawCode}</div>
          {data.category && (
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: categoryColor(data.category) ?? '#6E7480', textTransform: 'uppercase', letterSpacing: 1.5 }}>{data.category}</div>
          )}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: titleFont(clip(data.lawTitle, 200).length), lineHeight: 1.14, color: C.text, marginBottom: 28 }}>{clip(data.lawTitle, 200)}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ display: 'flex', background: data.statusColor, color: '#fff', fontSize: 24, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3 }}>
            {data.statusLabel}
          </div>
          {data.dateLine && <div style={{ display: 'flex', fontSize: 24, color: C.text, opacity: 0.8 }}>{data.dateLine}</div>}
        </div>

        {/* Equal flexible spacers above/below keep the arc vertically centered
            between the status badge and the party section — tweak the two
            flex/minHeight pairs here to rebalance. */}
        <div style={{ display: 'flex', flex: 1, minHeight: 16 }} />

        {/* Parliament arc — the decisive plenary vote, as a semicircle */}
        {data.voteChamber && (data.votesFor != null || data.votesAgainst != null) && (() => {
          const f = data.votesFor ?? 0, a = data.votesAgainst ?? 0, ab = data.votesAbstain ?? 0
          const absent = data.parties.reduce((s, p) => s + p.absent, 0)
          const dots = computeArcDots(f, a, ab, 0, absent)
          const long = data.lawTitle.length > 140, many = data.parties.length > 6
          // both at once (an OUG approval voted by nine groups) leaves room for a smaller arc only
          const arcH = long && many ? 250 : long || many ? 340 : 420
          const arcW = Math.round(952 * (arcH / 308))
          return (
            <div style={{ display: 'flex', width: '100%', height: arcH, justifyContent: 'center' }}>
              <svg width={arcW} height={arcH} viewBox="0 0 952 308">
                {dots.map((d, i) => (
                  <circle key={i} cx={d.x} cy={d.y} r={6} fill={d.color} />
                ))}
              </svg>
            </div>
          )
        })()}

        <div style={{ display: 'flex', flex: 1, minHeight: 16 }} />

        {/* Party vote — decisive plenary vote */}
        {data.parties.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
            <div style={{ display: 'flex', height: 1, background: C.hair, marginBottom: 14 }} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: C.navy, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.85 }}>
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
                      <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 6, background: color }} />
                      <div style={{ display: 'flex', fontSize: 24, color: '#6E7480' }}>{`${count} ${label}`}</div>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
            {(() => {
              const n = data.parties.length
              const rowH = n > 8 ? 32 : n > 6 ? 36 : n > 5 ? 40 : 44
              const barH = rowH < 38 ? 13 : 16
              return data.parties.map(p => {
                const t = p.for + p.against + p.abstain + p.absent
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', height: rowH }}>
                    <div style={{ display: 'flex', width: 76, justifyContent: 'flex-end', fontSize: 24, fontWeight: 600, color: C.text, opacity: 0.75, paddingRight: 10 }}>{p.name}</div>
                    <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, height: barH, borderRadius: 2, overflow: 'hidden', background: C.hair }}>
                      {seg(p.for, C.for)}
                      {seg(p.against, C.against)}
                      {seg(p.abstain, C.abstain)}
                      {seg(p.absent, C.absentDot)}
                    </div>
                    <div style={{ display: 'flex', width: 46, fontSize: 22, color: C.text, opacity: 0.8, paddingLeft: 8 }}>{t}</div>
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
            // green = adopted, red = rejected, gray = no vote yet (or a vote
            // this carousel reveals on a later slide); the displayed chamber is bold
            const color = s.outcome === 'adoptat' ? (s.active ? '#1F7A51' : C.for)
              : s.outcome === 'respins' ? '#C25539'
              : '#9AA0AA'
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', flexGrow: i === data.journey.length - 1 ? 0 : 1, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: s.active ? 700 : 600, letterSpacing: 1.5, textTransform: 'uppercase', color }}>
                  {s.label}
                  {s.outcome === 'adoptat' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : s.outcome === 'respins' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
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

      <CardFooter source={"surse: senat.ro · cdep.ro"} />
    </div>
  )
}
