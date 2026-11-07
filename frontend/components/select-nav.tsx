'use client'

import { useRouter } from 'next/navigation'

/** Labelled dropdown whose options are URLs: picking one navigates. Replaces the
 *  rows of round filter pills on /legi and /initiative. */
export function SelectNav({ label, value, options }: {
  label: string
  value: string
  options: { label: string; href: string }[]
}) {
  const router = useRouter()
  const id = `sel-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-[13px] text-muted">
      {label}
      <select
        id={id}
        value={value}
        onChange={e => router.push(e.target.value)}
        className="bg-surface border border-rim rounded-[2px] px-2.5 py-1.5 text-[13.5px] text-foreground focus:outline-none focus:border-foreground/50"
      >
        {options.map(o => <option key={o.href} value={o.href}>{o.label}</option>)}
      </select>
    </label>
  )
}
