// PostgREST hard-caps every response at 1000 rows. Any query whose result can
// grow past that must page, or it silently truncates — dropping arbitrary rows
// with no error. Shared by every server query that reads an unbounded table.
export const PAGE_SIZE = 1000

export async function allRows<T>(
  build: (lo: number, hi: number) => PromiseLike<{ data: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let lo = 0; ; lo += PAGE_SIZE) {
    const { data } = await build(lo, lo + PAGE_SIZE - 1)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) return out
  }
}
