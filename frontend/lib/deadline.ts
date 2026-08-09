import { todayRo } from '@/lib/utils'

/** Whole days until a tacit-adoption deadline, by calendar date in Romania's
 *  timezone — a fixed +03:00 offset flips a day early in winter (RO is +02:00),
 *  so compare RO calendar dates instead of doing epoch math. `today` is
 *  injectable for tests and defaults to the real RO date. */
export function daysLeft(deadline: string, today: string = todayRo()): number {
  const ms = Date.parse(deadline.slice(0, 10) + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')
  return Math.round(ms / 86_400_000)
}
