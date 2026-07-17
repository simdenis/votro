import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, capFirst, hasPartyLine } from '@/lib/utils'
import { AgreementMatrix, type MatrixParty, type AgreementBucket } from '@/components/charts/agreement-matrix'
import { AttendanceTrend, type TrendSeries } from '@/components/charts/attendance-trend'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Analize',
  description: 'Cine votează cu cine, cele mai strânse voturi și evoluția prezenței în Parlamentul României.',
}

// Preferred party order (big → small); only those present in the data show up.
const PARTY_ORDER = ['PSD', 'AUR', 'PNL', 'USR', 'UDMR', 'POT', 'SOSRO', 'PACE']
const MONTHS_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']

type AttendRow = { month: string; chamber: 'senate' | 'deputies'; attendance_pct: number }
type ClosestRow = {
  id: string; vote_date: string; chamber: 'senate' | 'deputies'
  for_count: number; against_count: number; margin: number
  law_code: string | null; law_title: string | null
}

export default async function AnalizePage() {
  const db = getDB()
  const [bucketRes, attendRes, closestRes, partiesRes, contestedRes] = await Promise.all([
    db.from('party_agreement_monthly').select('party_a, party_b, month, shared, agreed'),
    db.from('monthly_attendance').select('month, chamber, attendance_pct'),
    db.from('closest_votes').select('*').order('margin', { ascending: true }).limit(12),
    db.from('parties').select('abbreviation, color'),
    // contested-vote counts per chamber per month (migration 034 — resilient:
    // if the view isn't applied yet, .data is null and the footer just omits counts)
    db.from('contested_votes_by_month').select('chamber, month, n'),
  ])

  const colorOf: Record<string, string> = {}
  for (const p of (partiesRes.data ?? []) as { abbreviation: string; color: string }[]) colorOf[p.abbreviation] = p.color

  // month → { senate, deputies } contested-vote counts for the matrix footer
  const contestedByMonth: Record<string, { senate: number; deputies: number }> = {}
  for (const r of (contestedRes.data ?? []) as { chamber: 'senate' | 'deputies'; month: string; n: number }[]) {
    ;(contestedByMonth[r.month] ??= { senate: 0, deputies: 0 })[r.chamber] = r.n
  }

  // ── 1. Agreement matrix ────────────────────────────────────────────────
  const buckets = (bucketRes.data ?? []) as AgreementBucket[]
  // only parties that actually appear in contested-vote data (drops e.g. PACE,
  // which currently has no members mapped to it)
  const present = new Set<string>()
  for (const b of buckets) { present.add(b.party_a); present.add(b.party_b) }
  const parties: MatrixParty[] = PARTY_ORDER
    .filter(a => colorOf[a] && hasPartyLine(a) && present.has(a))
    .map(a => ({ abbr: a, color: colorOf[a] }))
  const agMonths = [...new Set(buckets.map(b => b.month))].sort()
  const agMonthLabels = agMonths.map(mk => {
    const [y, m] = mk.split('-').map(Number)
    return `${MONTHS_RO[m - 1]} '${String(y).slice(2)}`
  })

  // ── 2. Closest votes ───────────────────────────────────────────────────
  const closest = (closestRes.data ?? []) as ClosestRow[]
  // the view has no summary column — pull the AI summaries by law code
  const closestCodes = [...new Set(closest.map(v => v.law_code).filter((c): c is string => !!c))]
  const summaryOf: Record<string, string> = {}
  if (closestCodes.length) {
    const { data: sumRows } = await db.from('laws').select('code, summary').in('code', closestCodes)
    for (const r of (sumRows ?? []) as { code: string; summary: string | null }[]) {
      if (r.summary) summaryOf[r.code] = r.summary
    }
  }

  // ── 3. Attendance trend ────────────────────────────────────────────────
  const attend = (attendRes.data ?? []) as AttendRow[]
  const monthKeys = [...new Set(attend.map(r => r.month))].sort()
  const rateOf: Record<string, Record<string, number>> = { senate: {}, deputies: {} }
  for (const r of attend) rateOf[r.chamber][r.month] = r.attendance_pct
  const trend: TrendSeries[] = [
    { name: 'Senat',  color: '#4E86D8', points: monthKeys.map(mk => rateOf.senate[mk] ?? null) },
    { name: 'Cameră', color: '#B27A24', points: monthKeys.map(mk => rateOf.deputies[mk] ?? null) },
  ]
  const monthLabels = monthKeys.map(mk => {
    const [y, m] = mk.split('-').map(Number)
    return `${MONTHS_RO[m - 1]} '${String(y).slice(2)}`
  })

  return (
    <div className="space-y-14">
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Analize</h1>
        <p className="text-sm text-muted mt-2 max-w-2xl">
          Trei imagini de ansamblu asupra Parlamentului, de la începutul legislaturii (dec. 2024).
        </p>
      </div>

      {/* ── 1. Agreement matrix ─────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-serif text-[22px] font-normal text-foreground">Cine votează cu cine</h2>
        <p className="text-[13px] text-muted max-w-2xl">
          Cât de des au votat la fel majoritățile a două partide, pe <strong className="text-foreground">voturile disputate</strong>.
          Nuanța închisă = acord mare. Voturile aproape unanime sunt excluse — altfel toate partidele ar părea aliate.
        </p>
        <p className="text-[12.5px] text-faint max-w-2xl">
          Citește o celulă așa: <strong className="text-muted">X%</strong> = din voturile disputate din perioada aleasă,
          de câte ori majoritățile celor două partide au ales la fel (pentru / împotrivă / abținere).
        </p>
        {parties.length >= 2 && buckets.length > 0
          ? <AgreementMatrix parties={parties} months={agMonths} monthLabels={agMonthLabels} buckets={buckets} contestedByMonth={contestedByMonth} />
          : <p className="text-sm text-faint">Date insuficiente.</p>}
      </section>

      {/* ── 2. Closest votes ────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-serif text-[22px] font-normal text-foreground">Cele mai strânse voturi</h2>
        <p className="text-[13px] text-muted max-w-2xl">Voturile decise la cea mai mică diferență — unde fiecare prezență a contat.</p>
        <div className="divide-y divide-rim border-t border-rim">
          {closest.map(v => (
            <Link key={v.id} href={`/voturi/${v.id}`} className="flex items-center gap-4 py-3 hover:bg-raised transition-colors">
              <span className="text-[15px] font-bold tabular-nums text-foreground w-10 flex-shrink-0 text-center">
                {v.margin}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-faint mb-0.5">
                  <span className="font-mono">{v.law_code ?? 'Plen'}</span>
                  <span className="uppercase font-semibold">{v.chamber === 'deputies' ? 'Cameră' : 'Senat'}</span>
                  <span>{formatDate(v.vote_date)}</span>
                </div>
                <p className="text-[13.5px] text-foreground truncate">{capFirst(v.law_title ?? '') || 'Vot de plen'}</p>
                {v.law_code && summaryOf[v.law_code] && (
                  <p className="text-[12px] text-muted mt-0.5 line-clamp-2">{summaryOf[v.law_code]}</p>
                )}
              </div>
              <span className="text-[12px] tabular-nums flex-shrink-0 font-medium">
                <span style={{ color: 'var(--color-for)' }}>{v.for_count}</span>
                <span className="text-faint">–</span>
                <span style={{ color: 'var(--color-against)' }}>{v.against_count}</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-faint">„Diferența" = pentru − împotrivă. Doar voturi cu prezență reală (≥ 100).</p>
      </section>

      {/* ── 3. Attendance trend ─────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-serif text-[22px] font-normal text-foreground">Prezența în timp</h2>
        <p className="text-[13px] text-muted max-w-2xl">
          Prezența medie la voturile din plen, lună de lună, pe cameră. Vacanțele parlamentare apar ca goluri.
        </p>
        {monthKeys.length > 1
          ? <AttendanceTrend months={monthLabels} series={trend} />
          : <p className="text-sm text-faint">Date insuficiente.</p>}
      </section>
    </div>
  )
}
