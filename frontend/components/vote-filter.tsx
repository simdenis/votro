'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from './skeleton'

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

/** Every month of the legislature (from Dec 2024), newest first. */
const MONTHS: { value: string; label: string }[] = (() => {
  const out = []
  const now = new Date()
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d >= new Date(2024, 11, 1); d.setMonth(d.getMonth() - 1)) {
    out.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${RO_MONTHS[d.getMonth()]} ${d.getFullYear()}` })
  }
  return out
})()

function FilterInner({ categories }: { categories: string[] }) {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`/voturi?${next.toString()}`)
  }

  const baseInput = 'border border-rim rounded-[2px] text-sm px-2.5 py-1.5 bg-surface text-foreground focus:outline-none focus:border-foreground/50'

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select
        className={baseInput}
        aria-label="Filtrează după rezultat"
        value={params.get('outcome') ?? ''}
        onChange={e => update('outcome', e.target.value)}
      >
        <option value="">Toate rezultatele</option>
        <option value="adoptat">Adoptate</option>
        <option value="respins">Respinse</option>
      </select>

      {categories.length > 0 && (
        <select
          className={baseInput}
          aria-label="Filtrează după categorie"
          value={params.get('category') ?? ''}
          onChange={e => update('category', e.target.value)}
        >
          <option value="">Toate categoriile</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      {/* one month at a time, written the Romanian way (a native date input shows
          the browser's locale, mm/dd/yyyy for US visitors) */}
      <select
        className={baseInput}
        aria-label="Filtrează după lună"
        value={params.get('from')?.slice(0, 7) ?? ''}
        onChange={e => {
          const m = e.target.value
          const next = new URLSearchParams(params.toString())
          next.delete('page')
          if (m) {
            const [y, mo] = m.split('-').map(Number)
            next.set('from', `${m}-01`)
            next.set('to', `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`)
          } else { next.delete('from'); next.delete('to') }
          router.push(`/voturi?${next.toString()}`)
        }}
      >
        <option value="">Toate lunile</option>
        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>

      {(params.get('outcome') || params.get('category') || params.get('from') || params.get('to')) && (
        <button
          onClick={() => router.push('/voturi')}
          className="text-sm text-muted hover:text-foreground"
        >
          Resetează filtrele
        </button>
      )}
    </div>
  )
}

export function VoteFilter({ categories = [] }: { categories?: string[] }) {
  return (
    <Suspense fallback={<Skeleton className="h-9 w-96" />}>
      <FilterInner categories={categories} />
    </Suspense>
  )
}
