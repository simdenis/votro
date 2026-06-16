import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VoteChoice } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function choiceLabel(choice: VoteChoice | string): string {
  const map: Record<string, string> = {
    for: 'Pentru',
    against: 'Împotrivă',
    abstention: 'Abținere',
    not_voted: 'Nu a votat',
    absent: 'Absent',
  }
  return map[choice] ?? choice
}

export function choiceColor(choice: VoteChoice | string): string {
  const map: Record<string, string> = {
    for: '#16a34a',
    against: '#dc2626',
    abstention: '#9ca3af',
    not_voted: '#9ca3af',
    absent: '#d1d5db',
  }
  return map[choice] ?? '#9ca3af'
}

export function textOnColor(bgHex: string): string {
  // PNL yellow needs black text; everything else uses white
  return bgHex === '#ffdd00' ? '#000000' : '#ffffff'
}

export function pct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  2)  return 'chiar acum'
  if (hours <  1)  return `acum ${mins} min`
  if (hours <  24) return `acum ${hours}h`
  if (days  === 1) return 'ieri'
  if (days  <  7)  return `acum ${days} zile`
  return formatDateShort(dateStr.slice(0, 10))
}
