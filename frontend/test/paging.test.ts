import { describe, it, expect, vi } from 'vitest'
import { allRows, PAGE_SIZE } from '@/lib/paging'

// Regression guard for the silent-truncation bug: PostgREST caps every response
// at PAGE_SIZE rows, so an unpaged read of a large table drops arbitrary rows
// with no error (corrupted analize matrix, misclassified switchers). allRows
// must return the WHOLE table across pages, and must terminate.

/** Fake PostgREST: returns rows[lo..hi], capped at PAGE_SIZE like the real API. */
function fakeTable(rows: number[]) {
  return (lo: number, hi: number) => {
    const slice = rows.slice(lo, Math.min(hi, lo + PAGE_SIZE - 1) + 1)
    return Promise.resolve({ data: slice })
  }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('allRows', () => {
  it('returns every row when the table is larger than the 1000-row cap', async () => {
    const rows = range(2500)
    const out = await allRows<number>(fakeTable(rows))
    expect(out).toHaveLength(2500)
    expect(out).toEqual(rows) // order preserved, nothing dropped
  })

  it('a single unpaged read would truncate — allRows does not', async () => {
    const rows = range(2500)
    const unpaged = (await fakeTable(rows)(0, PAGE_SIZE - 1)).data as number[]
    expect(unpaged).toHaveLength(PAGE_SIZE) // proves the bug exists without paging
    expect(await allRows<number>(fakeTable(rows))).toHaveLength(2500)
  })

  it('requests contiguous PAGE_SIZE windows', async () => {
    const build = vi.fn(fakeTable(range(2500)))
    await allRows<number>(build)
    expect(build.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('terminates on an exact multiple of PAGE_SIZE without looping forever', async () => {
    const build = vi.fn(fakeTable(range(2000)))
    const out = await allRows<number>(build)
    expect(out).toHaveLength(2000)
    expect(build).toHaveBeenCalledTimes(3) // 1000, 1000, then an empty page → stop
  })

  it('handles an empty table', async () => {
    expect(await allRows<number>(fakeTable([]))).toEqual([])
  })

  it('treats a null data payload as an empty final page', async () => {
    const out = await allRows<number>(() => Promise.resolve({ data: null }))
    expect(out).toEqual([])
  })
})
