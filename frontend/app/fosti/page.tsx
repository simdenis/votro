import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { countNoun, personSlug, textOnColor } from '@/lib/utils'
import { SectionNav, PARLAMENTARI_SECTIONS } from '@/components/section-nav'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Foști parlamentari',
  description:
    'Parlamentarii al căror mandat s-a încheiat în legislatura curentă — cu istoricul complet de voturi.',
}

interface FormerMember {
  id: string
  name: string
  first_name: string
  chamber: 'senate' | 'deputies'
  mandate_start: string | null
  mandate_end: string | null
  mandate_end_reason: string | null
  replaced_by: string | null
  parties: { abbreviation: string; color: string | null } | null
}

function fmt(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// cdep names the successor "Sorin Năcuţă"; our row is name=Năcuţă,
// first_name=Sorin. Diacritics differ between the two sources (ţ vs ț), so
// compare unaccented, order-free token sets.
function nameKey(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .split(/[\s-]+/).filter(Boolean).sort().join(' ')
}

export default async function FostiPage() {
  const db = getDB()
  const [{ data }, { data: actives }] = await Promise.all([
    db.from('politicians')
      .select('id, name, first_name, chamber, mandate_start, mandate_end, mandate_end_reason, replaced_by, parties(abbreviation, color)')
      .eq('active', false)
      .order('mandate_end', { ascending: false, nullsFirst: false }),
    db.from('politicians').select('name, first_name, chamber').eq('active', true),
  ])
  const members = (data as unknown as FormerMember[] | null) ?? []
  // successor name -> profile href, per chamber
  const successorHref = new Map<string, string>()
  for (const p of (actives as { name: string; first_name: string; chamber: string }[] | null) ?? []) {
    const base = p.chamber === 'senate' ? '/senatori' : '/deputati'
    successorHref.set(`${p.chamber}:${nameKey(`${p.first_name} ${p.name}`)}`, `${base}/${personSlug(p.first_name, p.name)}`)
  }
  const senate = members.filter(m => m.chamber === 'senate')
  const camera = members.filter(m => m.chamber === 'deputies')

  return (
    <div className="space-y-6">
      <SectionNav items={PARLAMENTARI_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Foști parlamentari
        </h1>
        <p className="text-sm text-muted mt-3 max-w-2xl">
          Parlamentari al căror mandat s-a încheiat în legislatura curentă (demisie, deces,
          incompatibilitate). Fișele lor rămân publice, cu tot istoricul de voturi — doar nu mai
          apar în liste și clasamente.
        </p>
      </div>

      {!members.length ? (
        <p className="text-sm text-muted py-8">Niciun mandat încheiat în legislatura curentă.</p>
      ) : (
        <div className="space-y-8">
          <p className="text-[13px] text-muted">
            {members.length} {countNoun(members.length, 'mandat încheiat', 'mandate încheiate')} — {' '}
            {senate.length} în Senat, {camera.length} în Cameră.
          </p>

          {([['Senat', senate, '/senatori'], ['Camera Deputaților', camera, '/deputati']] as const).map(
            ([label, group, base]) =>
              group.length > 0 && (
                <section key={label}>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4 border-b border-rim pb-2">
                    {label} ({group.length})
                  </h2>
                  <div className="space-y-3">
                    {group.map(m => {
                      const href = m.replaced_by
                        ? successorHref.get(`${m.chamber}:${nameKey(m.replaced_by)}`)
                        : undefined
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-4 bg-surface border border-rim rounded-xl px-4 py-3"
                        >
                          <Link
                            href={`${base}/${personSlug(m.first_name, m.name)}`}
                            className="font-medium text-foreground min-w-0 flex-shrink-0 w-48 truncate hover:underline underline-offset-2"
                          >
                            {m.first_name} {m.name}
                          </Link>
                          {m.parties && (
                            <span
                              className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-semibold flex-shrink-0"
                              style={{
                                backgroundColor: m.parties.color ?? '#9e9e9e',
                                color: textOnColor(m.parties.color ?? '#9e9e9e'),
                              }}
                            >
                              {m.parties.abbreviation}
                            </span>
                          )}
                          <span className="text-[13px] text-muted flex-1 text-right">
                            {m.mandate_end
                              ? <>mandat încheiat la {fmt(m.mandate_end)}{m.mandate_end_reason ? ` — ${m.mandate_end_reason}` : ''}</>
                              : 'mandat încheiat'}
                            {m.replaced_by && (
                              <>
                                {' · înlocuit de '}
                                {href
                                  ? <Link href={href} className="text-foreground/80 hover:underline underline-offset-2">{m.replaced_by}</Link>
                                  : m.replaced_by}
                              </>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </div>
  )
}
