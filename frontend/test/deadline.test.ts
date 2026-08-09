import { describe, it, expect } from 'vitest'
import { daysLeft } from '@/lib/deadline'

// Regression guard for the winter-timezone bug: the old code computed the
// deadline end-of-day with a fixed +03:00 offset, so between 23:00–24:00 RO
// time in winter (RO is +02:00) a same-day deadline read as "termen depășit" a
// day early. daysLeft now diffs RO calendar dates — a pure, tz-independent
// day count. `today` is injectable so these assertions don't depend on the clock.

describe('daysLeft', () => {
  it('same calendar date is 0 days ("azi"), never negative', () => {
    expect(daysLeft('2026-01-15', '2026-01-15')).toBe(0) // the winter regression
    expect(daysLeft('2026-02-01', '2026-02-01')).toBe(0)
  })

  it('counts whole days before and after the deadline', () => {
    expect(daysLeft('2026-01-15', '2026-01-14')).toBe(1)
    expect(daysLeft('2026-01-15', '2026-01-16')).toBe(-1)
    expect(daysLeft('2026-01-20', '2026-01-15')).toBe(5)
  })

  it('spans months without an off-by-one', () => {
    expect(daysLeft('2026-04-01', '2026-03-01')).toBe(31) // March has 31 days
  })

  it('ignores any time/offset suffix on the deadline (date-only compare)', () => {
    expect(daysLeft('2026-01-20T23:59:59+03:00', '2026-01-15')).toBe(5)
  })
})
