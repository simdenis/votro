import Link from 'next/link'
import type { Metadata } from 'next'
import { getSwitchers } from '@/lib/switchers'
import { textOnColor, countNoun } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Traseiști',
  description: 'Parlamentarii care au schimbat partidul în timpul mandatului actual — cu traseul complet.',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })
}

export default async function TraseistiPage() {
  const switchers = await getSwitchers()
  const senate = switchers.filter(s => s.chamber === 'senate')
  const camera = switchers.filter(s => s.chamber === 'deputies')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Traseiști
        </h1>
        <p className="text-sm text-muted mt-3 max-w-2xl">
          Parlamentarii care au schimbat partidul (sau au devenit neafiliați) de la începutul
          mandatului actual. Traseul e reconstruit din partidul cu care au votat la fiecare
          ședință de plen — de aceea apar aici doar schimbări reflectate în voturi nominale.
        </p>
      </div>

      {!switchers.length ? (
        <p className="text-sm text-muted py-8">Niciun traseist înregistrat până acum.</p>
      ) : (
        <div className="space-y-8">
          <p className="text-[13px] text-muted">
            {switchers.length} {countNoun(switchers.length, 'parlamentar', 'parlamentari')} — {' '}
            {senate.length} din Senat, {camera.length} din Cameră.
          </p>

          {([['Senat', senate, '/senators'], ['Camera Deputaților', camera, '/deputies']] as const).map(
            ([label, group, base]) =>
              group.length > 0 && (
                <section key={label}>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4 border-b border-rim pb-2">
                    {label} ({group.length})
                  </h2>
                  <div className="space-y-3">
                    {group.map(s => (
                      <Link
                        key={s.politician_id}
                        href={`${base}/${s.politician_id}`}
                        className="flex items-center gap-4 bg-surface border border-rim rounded-xl px-4 py-3 hover:bg-raised transition-colors"
                      >
                        <span className="font-medium text-foreground min-w-0 flex-shrink-0 w-48 truncate">
                          {s.first_name} {s.name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap flex-1">
                          {s.segments.map((seg, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                              {i > 0 && <span className="text-faint" aria-hidden>→</span>}
                              <span
                                className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-semibold"
                                style={{ backgroundColor: seg.color ?? '#9e9e9e', color: textOnColor(seg.color ?? '#9e9e9e') }}
                                title={`${fmt(seg.from_date)} – ${seg.to_date ? fmt(seg.to_date) : 'prezent'}`}
                              >
                                {seg.abbreviation}
                              </span>
                            </span>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}

      <p className="text-xs text-faint max-w-2xl pt-2">
        Notă: traseul acoperă doar mandatul actual și doar partidele cu care parlamentarul a
        votat efectiv în plen. „Neafiliat" (IND) înseamnă că a părăsit grupul fără să adere la altul.
      </p>
    </div>
  )
}
