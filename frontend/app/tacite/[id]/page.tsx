import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, isUuid, lawSlug, slugToCode, countNoun } from '@/lib/utils'
import { DeadlineBadge, daysLeft } from '@/components/deadline-badge'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'
import type { PendingBill } from '@/lib/types'

export const revalidate = 600 // ISR — the countdown only needs day granularity

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://la-butoane.ro'

// Addressed by code slug (/tacite/BP186-2026); UUIDs still resolve.
// cache(): generateMetadata and the page share one query per render.
const getBill = cache(async (id: string): Promise<PendingBill | null> => {
  const q = getDB().from('pending_bills').select('*')
  const { data } = await (isUuid(id) ? q.eq('id', id) : q.eq('code', slugToCode(id))).maybeSingle()
  return data as PendingBill | null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const bill = await getBill(id)
  if (!bill) return { title: 'Termen tacit' }
  const d = bill.tacit_deadline ? daysLeft(bill.tacit_deadline) : null
  const desc = [
    bill.title ?? bill.code,
    bill.tacit_deadline
      ? d != null && d >= 0
        ? `Devine lege fără vot pe ${formatDate(bill.tacit_deadline)} dacă Camera Deputaților nu îl dezbate — mai sunt ${d} ${countNoun(d, 'zi', 'zile')}.`
        : `Termenul constituțional a expirat pe ${formatDate(bill.tacit_deadline)}.`
      : '',
  ].filter(Boolean).join(' ')
  return {
    title: `${bill.code} — termen de adoptare tacită`,
    description: desc.slice(0, 300),
    alternates: { canonical: `/tacite/${lawSlug(bill.code)}` },
    openGraph: { title: `${bill.code} — termen de adoptare tacită`, description: desc.slice(0, 300) },
  }
}

export default async function TacitBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bill = await getBill(id)
  if (!bill) notFound()

  const d = bill.tacit_deadline ? daysLeft(bill.tacit_deadline) : null
  const expired = d != null && d < 0

  return (
    <div className="space-y-8 max-w-3xl">
      <SectionNav items={LEGI_SECTIONS} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/tacite" className="hover:text-foreground transition-colors">Termene tacite</Link>
        <span className="text-faint">›</span>
        <span className="font-semibold text-foreground font-mono">{bill.code}</span>
      </div>

      {/* Header + countdown */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="font-mono text-sm font-bold text-muted">{bill.code}</span>
          <span className="text-[11px] uppercase tracking-wide text-faint">Camera Deputaților · primă cameră sesizată</span>
        </div>
        <h1 className="font-serif text-[26px] sm:text-[32px] font-normal text-foreground leading-[1.15] tracking-[-0.01em]">
          {bill.title ?? bill.code}
        </h1>
      </div>

      {/* Deadline card */}
      {bill.tacit_deadline && (
        <div
          className="bg-surface border border-rim rounded-xl p-5"
          style={{ borderLeftWidth: 4, borderLeftColor: expired ? 'var(--rim)' : d != null && d <= 10 ? 'var(--color-against)' : 'var(--sidebar-bg)' }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted font-semibold mb-1.5">
                {expired ? 'Termenul a expirat' : 'Devine lege fără vot pe'}
              </p>
              <p className="text-[20px] font-bold text-foreground">{formatDate(bill.tacit_deadline)}</p>
              {bill.term_days && (
                <p className="text-[12px] text-muted mt-1">Termen constituțional: {bill.term_days}</p>
              )}
            </div>
            <DeadlineBadge deadline={bill.tacit_deadline} size="lg" />
          </div>
          <p className="text-[13px] text-muted leading-relaxed mt-4 pt-4 border-t border-rim">
            {expired
              ? 'Termenul constituțional a trecut fără vot în plen — proiectul este considerat adoptat tacit de prima cameră și merge la camera decizională. Statutul oficial se confirmă pe fișa cdep.ro.'
              : <>Constituția (art. 75) dă primei camere sesizate 45 de zile — 60 pentru coduri și legi
                 complexe — să se pronunțe. Dacă termenul expiră fără vot, proiectul e{' '}
                 <strong className="text-foreground">considerat adoptat, fără ca cineva să fi votat</strong>,
                 și merge la camera decizională. Termenul se suspendă în vacanțele parlamentare.</>}
          </p>
        </div>
      )}

      {/* Details */}
      <div className="space-y-2 text-sm">
        {bill.committee && (
          <p className="text-muted">
            <span className="font-semibold text-foreground">Comisia sesizată:</span> {bill.committee}
          </p>
        )}
        <p className="text-muted">
          <span className="font-semibold text-foreground">Stadiu:</span>{' '}
          {expired ? 'termen expirat — vezi fișa oficială pentru statutul curent' : 'în termen — poate fi dezbătut sau adoptat tacit'}
        </p>
      </div>

      {/* Official sources */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {bill.source_url && (
          <a href={bill.source_url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
            Fișa oficială a proiectului (cdep.ro) →
          </a>
        )}
        {bill.pdf_url && (
          <a href={bill.pdf_url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
            Textul proiectului (PDF) →
          </a>
        )}
      </div>

      <p className="text-xs text-faint max-w-2xl border-t border-rim pt-4">
        Datele provin din lista oficială de termene a Camerei Deputaților, actualizată zilnic
        (ultima verificare: {formatDate(bill.scraped_at.slice(0, 10))}). Proiectele cu Senatul ca
        primă cameră nu au o listă publică echivalentă.{' '}
        <Link href="/despre" className="underline underline-offset-2 hover:text-foreground">Cum funcționează adoptarea tacită →</Link>
      </p>
    </div>
  )
}
