import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contribuie — VotRO',
  description: 'Susține VotRO și ajută-ne să menținem transparența parlamentară din România.',
}

export default function ContribuiePage() {
  return (
    <div className="max-w-2xl space-y-10">
      <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Contribuie</h1>

      <section className="space-y-3">
        <p className="text-foreground leading-relaxed">
          VotRO este un proiect independent, fără publicitate și fără finanțare instituțională.
          Dacă îți este util, poți susține dezvoltarea lui continuă.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Susținere financiară</h2>
        <p className="text-foreground leading-relaxed text-sm">
          Contribuțiile acoperă costurile de server și dezvoltarea de noi funcționalități.
          Susținătorii sunt menționați pe această pagină (opțional).
        </p>
        <a
          href="https://patreon.com/votro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-foreground text-page text-sm font-medium hover:opacity-80 transition-opacity"
        >
          Patreon
        </a>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Comunitate</h2>
        <p className="text-foreground leading-relaxed text-sm">
          Discuții despre date parlamentare, sugestii de funcționalități și actualizări de pe Discord.
        </p>
        <a
          href="https://discord.gg/votro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-rim text-foreground text-sm font-medium hover:bg-surface transition-colors"
        >
          Discord
        </a>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Propune funcționalități</h2>
        <p className="text-foreground leading-relaxed text-sm">
          Ai o idee? Trimite-o prin email sau pe Discord — cele mai cerute ajung în roadmap.
        </p>
        <a
          href="mailto:siminiucdenis@gmail.com?subject=Sugestie%20VotRO"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-rim text-foreground text-sm font-medium hover:bg-surface transition-colors"
        >
          Trimite sugestie
        </a>
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
