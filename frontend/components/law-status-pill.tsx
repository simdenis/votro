import type { LawStatus } from '@/lib/types'

/** One at-a-glance verdict per law, so the /legi list is scannable without
 *  reading the three per-stage columns (which are hidden on mobile anyway).
 *  Precedence: presidential outcome → chamber rejection → both-chambers pass →
 *  in-progress. */
export function lawStatusPill(law: Pick<LawStatus,
  'presidential_status' | 'senate_outcome' | 'camera_outcome' | 'status'>): { label: string; color: string; bg: string } {
  if (law.presidential_status === 'promulgat') return pill('Promulgată', 'var(--color-for-dark)', 'rgba(46,168,113,0.12)')
  if (law.presidential_status === 'retrimis')  return pill('Retrimisă',  'var(--color-against-dark)', 'rgba(238,123,94,0.14)')
  if (law.presidential_status === 'sesizat_ccr') return pill('La CCR',    'var(--color-abstention-dark)', 'rgba(227,162,60,0.16)')
  if (law.senate_outcome === 'respins' || law.camera_outcome === 'respins')
    return pill('Respinsă', 'var(--color-against-dark)', 'rgba(238,123,94,0.14)')
  if (law.status === 'complet') return pill('Adoptată', 'var(--color-for-dark)', 'rgba(46,168,113,0.12)')
  return pill('În lucru', 'var(--muted)', 'var(--raised)')
}

function pill(label: string, color: string, bg: string) {
  return { label, color, bg }
}

export function LawStatusPill({ law }: { law: Parameters<typeof lawStatusPill>[0] }) {
  const { label, color, bg } = lawStatusPill(law)
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 flex-shrink-0"
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  )
}
