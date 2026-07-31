// Banner on the profile of a member whose mandate ended: their page stays
// public (vote history is a matter of record, and Google still sends people
// here), but a visitor must see immediately that this person is no longer in
// Parliament. Rendered by both /senatori/[id] and /deputati/[id].

export interface MandateRow {
  active: boolean
  mandate_end: string | null
  mandate_end_reason: string | null
}

function fmt(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function MandateEndedNote({ row }: { row: MandateRow | null }) {
  if (!row || row.active) return null
  return (
    <div className="bg-surface border border-rim rounded-xl px-4 py-3 flex items-start gap-2.5 mb-6">
      <span className="text-muted text-sm leading-none mt-0.5" aria-hidden>ⓘ</span>
      <p className="text-sm text-muted leading-relaxed">
        <span className="font-medium text-foreground">Mandat încheiat</span>
        {row.mandate_end ? ` la ${fmt(row.mandate_end)}` : ''}
        {row.mandate_end_reason ? ` (${row.mandate_end_reason})` : ''}
        {'. '}Statisticile și istoricul de vot de mai jos acoperă perioada mandatului.
      </p>
    </div>
  )
}
