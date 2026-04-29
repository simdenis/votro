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
