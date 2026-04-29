import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Despre VotRO',
  description: 'Cum funcționează VotRO, cum sunt colectate datele și ce înseamnă devierea de la linia de partid.',
}

export default function DesprePage() {
  return (
    <div className="max-w-2xl space-y-10">
      <h1 className="text-2xl font-semibold text-foreground">Despre VotRO</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Ce este VotRO</h2>
        <p className="text-foreground leading-relaxed">
          VotRO urmărește voturile plenare ale Senatului și Camerei Deputaților din România și le face
          accesibile publicului larg într-un format clar și comparabil.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Cum sunt colectate datele</h2>
        <p className="text-foreground leading-relaxed">
          Un scraper automat descarcă zilnic datele de vot publice de pe{' '}
          <a href="https://senat.ro" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">
            senat.ro
          </a>{' '}
          și{' '}
          <a href="https://cdep.ro" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">
            cdep.ro
          </a>
          . Datele sunt stocate într-o bază de date proprie și nu sunt modificate față de sursa originală.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Ce înseamnă devierea de la linia de partid</h2>
        <p className="text-foreground leading-relaxed">
          Pentru fiecare vot, calculăm poziția majorității fiecărui partid (pentru / împotrivă / abținere).
          Un parlamentar este marcat cu <span className="text-deviere font-semibold">⚠ deviere</span> dacă
          a votat altfel decât majoritatea colegilor săi de partid în acel vot specific.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Nota: absenții și cei care nu au votat nu sunt considerați în calculul devierilor — doar voturile
          exprimate (pentru / împotrivă / abținere) contează.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Limitări ale datelor</h2>
        <ul className="text-foreground leading-relaxed space-y-1.5 list-disc list-inside text-sm">
          <li>Acoperă voturile nominale din plenul Senatului și Camerei Deputaților.</li>
          <li>Nu include comisii parlamentare sau voturi prin vot electronic secret.</li>
          <li>Datele sunt actualizate zilnic — poate exista un decalaj de până la 24 de ore față de votul live.</li>
          <li>Calitatea datelor depinde de sursa oficială (senat.ro / cdep.ro).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Contact</h2>
        <p className="text-foreground leading-relaxed text-sm">
          Pentru întrebări sau sesizări:{' '}
          <a href="mailto:siminiucdenis@gmail.com" className="underline hover:text-muted">
            siminiucdenis@gmail.com
          </a>
        </p>
        <p className="text-sm text-muted">
          VotRO nu este afiliat niciunui partid politic, organizație sau publicație.
        </p>
      </section>

      <section className="space-y-2 border-t border-rim pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Surse de date</h2>
        <div className="flex gap-4 text-sm">
          <a href="https://senat.ro" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground underline">
            senat.ro
          </a>
          <a href="https://cdep.ro" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground underline">
            cdep.ro
          </a>
        </div>
      </section>
    </div>
  )
}
