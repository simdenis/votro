import type { Metadata } from 'next'
import { SectionNav, DESPRE_SECTIONS } from '@/components/section-nav'
import { Feedback } from '@/components/feedback'

export const metadata: Metadata = {
  title: 'Contribuie — LaButoane',
  description: 'Susține LaButoane și ajută-ne să menținem transparența parlamentară din România.',
}

export default function ContribuiePage() {
  return (
    <div className="max-w-2xl space-y-10">
      <SectionNav items={DESPRE_SECTIONS} />
      <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Contribuie</h1>

      <section className="space-y-3">
        <p className="text-foreground leading-relaxed">
          LaButoane este un proiect independent, fără publicitate și fără finanțare instituțională.
          Dacă îți este util, poți susține dezvoltarea lui continuă.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Propune funcționalități</h2>
        <p className="text-foreground leading-relaxed text-sm">
          Ai o idee sau un feedback? Spune-ne. Cele mai cerute ajung în roadmap.
        </p>
        <Feedback variant="button" label="Trimite o sugestie" />
      </section>

      <section className="space-y-3 border-t border-rim pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Susținători</h2>
        <p className="text-sm text-muted">
          Primii susținători vor apărea aici.
        </p>
      </section>
    </div>
  )
}
