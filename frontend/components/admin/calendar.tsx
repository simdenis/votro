// /admin calendar strip — what the posting grid says is due today and this
// week. Reads the same JSON the VPS digest uses (public/posting-schedule.json),
// so the two can't drift. Pure display: every slot links to the section below
// that holds the ready-to-publish card.
import schedule from '@/public/posting-schedule.json'

interface Slot {
  id: string; title: string; format: 'feed' | 'story'; time: string
  weekday?: number | number[]; day_of_month?: number; months?: number[]
  in_recess?: string; section: string; why?: string; event?: string
}

const RO_DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică']

/** Today's date parts in Bucharest time (the server runs in UTC). */
function bucharestToday(): { y: number; m: number; d: number; iso: number } {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).split('-').map(Number)
  const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()  // 0 = Sunday
  return { y: p[0], m: p[1], d: p[2], iso: dow === 0 ? 7 : dow }
}

function inSession(m: number, d: number): boolean {
  const md = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return (schedule.sessions as { from: string; to: string }[]).some(s => s.from <= md && md <= s.to)
}

function matches(s: Slot, iso: number, m: number, d: number): boolean {
  if (s.months && !s.months.includes(m)) return false
  if (s.day_of_month != null) return d === s.day_of_month
  if (s.weekday == null) return false
  return (Array.isArray(s.weekday) ? s.weekday : [s.weekday]).includes(iso)
}

export function dueSlots(iso: number, m: number, d: number): Slot[] {
  const session = inSession(m, d)
  const out: Slot[] = []
  for (const s of schedule.slots as Slot[]) {
    if (!matches(s, iso, m, d) || s.event) continue  // event slots (party switches) show as a footnote
    const mode = s.in_recess ?? 'keep'
    // "skip" / "replace:<id>": not in recess (the <id> slot carries in_recess "only" and shows itself)
    if (!session && (mode === 'skip' || mode.startsWith('replace:'))) continue
    if (session && mode === 'only') continue
    out.push(s)
  }
  return out
}

export function PostingCalendar() {
  const t = bucharestToday()
  const session = inSession(t.m, t.d)
  // the week's other days, as calendar dates (for the day-of-month rules)
  const monday = new Date(Date.UTC(t.y, t.m - 1, t.d - (t.iso - 1)))
  const week = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday.getTime() + i * 86400_000)
    return { iso: i + 1, m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
  })
  const today = dueSlots(t.iso, t.m, t.d)
  return (
    <section className="mt-6 border border-rim rounded-xl p-4" id="calendar">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="text-[15px] font-bold">Calendar — azi, {RO_DAYS[t.iso - 1]} {t.d}.{String(t.m).padStart(2, '0')}</h2>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-faint border border-rim rounded px-1.5 py-px">
          {session ? 'sesiune' : 'vacanță parlamentară'}
        </span>
      </div>
      {today.length === 0 ? (
        <p className="text-[13px] text-faint mt-2">Nimic programat azi.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {today.map(s => (
            <li key={s.id} className="text-[13px] flex items-baseline gap-2 flex-wrap">
              <span className={`text-[10px] uppercase tracking-wider font-semibold rounded px-1.5 py-px ${s.format === 'story' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                {s.format} · {s.time}
              </span>
              <a href={`#${s.section}`} className="font-medium hover:underline">{s.title}</a>
              {s.why && <span className="text-[12px] text-faint">— {s.why}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid grid-cols-7 gap-1 text-[11px]">
        {week.map(w => {
          const items = dueSlots(w.iso, w.m, w.d)
          const isToday = w.iso === t.iso
          return (
            <div key={w.iso} className={`rounded-lg border p-1.5 min-h-[64px] ${isToday ? 'border-ink' : 'border-rim'}`}>
              <div className={`font-semibold ${isToday ? '' : 'text-faint'}`}>{RO_DAYS[w.iso - 1].slice(0, 3)} {w.d}</div>
              {items.map(s => (
                <a key={s.id} href={`#${s.section}`} className={`block truncate hover:underline ${s.format === 'story' ? 'text-amber-800' : ''}`} title={s.title}>
                  {s.format === 'story' ? '◦ ' : '• '}{s.title}
                </a>
              ))}
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-faint mt-2">
        Schimbările de partid se postează ca story în ziua anunțului (secțiunea „Astăzi”), nu pe calendar. Grila și motivația fiecărui slot: <code>public/posting-schedule.json</code> · <code>docs/POSTING_SCHEDULE.md</code>. Emailul „Azi pe IG” vine la 09:00.
      </p>
    </section>
  )
}
