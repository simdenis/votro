'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from './skeleton'

function FilterInner({ categories }: { categories: string[] }) {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`/votes?${next.toString()}`)
  }

  const baseInput = 'border border-rim rounded-md text-sm px-3 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-[#5050c0]'

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select
        className={baseInput}
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
          value={params.get('category') ?? ''}
          onChange={e => update('category', e.target.value)}
        >
          <option value="">Toate categoriile</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      <input
        type="date"
        className={baseInput}
        value={params.get('from') ?? ''}
        onChange={e => update('from', e.target.value)}
      />

      <input
        type="date"
        className={baseInput}
        value={params.get('to') ?? ''}
        onChange={e => update('to', e.target.value)}
      />

      {(params.get('outcome') || params.get('category') || params.get('from') || params.get('to')) && (
        <button
          onClick={() => router.push('/votes')}
          className="text-sm text-muted underline underline-offset-2"
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
