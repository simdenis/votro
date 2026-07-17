import type { Metadata } from 'next'
import { SectionNav, DESPRE_SECTIONS } from '@/components/section-nav'
import { CopyCode } from '@/components/copy-code'
import { ApiBuilder } from '@/components/api-builder'

export const metadata: Metadata = {
  title: 'Date deschise',
  description: 'API public și export CSV/JSON cu toate voturile Parlamentului României — pentru jurnaliști, cercetători și dezvoltatori.',
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://la-butoane.ro'

const Code = CopyCode

export default function DatePage() {
  return (
    <div className="max-w-2xl space-y-10">
      <SectionNav items={DESPRE_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Date deschise</h1>
        <p className="text-foreground leading-relaxed mt-4">
          Toate datele LaButoane sunt publice și interogabile printr-un API simplu, fără cont și fără
          cheie — răspuns JSON sau CSV. Dacă publici ceva pe baza lor, un link către la-butoane.ro e
          tot ce cerem. Datele provin din sursele oficiale (senat.ro, cdep.ro) și acoperă voturile de
          plen de la începutul actualei legislaturi (20 decembrie 2024).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Constructor de interogări</h2>
        <p className="text-sm text-foreground leading-relaxed">
          Alege ce vrei, completează câmpurile, și primești comanda gata de rulat — sau descarcă
          direct fișierul. Fără cont, fără cod.
        </p>
        <ApiBuilder siteUrl={SITE} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Acces rapid</h2>
        <p className="text-sm text-foreground leading-relaxed">
          Endpoint-urile <code className="text-[12.5px] bg-raised px-1 rounded">/api/v1</code> sunt
          publice, fără cheie și memorate în cache — adaugă{' '}
          <code className="text-[12.5px] bg-raised px-1 rounded">?format=csv</code> pentru CSV
          (se deschide direct în Excel).
        </p>
        <Code>{`# voturile dintr-o perioadă, JSON
curl "${SITE}/api/v1/votes?from=2026-01-01&to=2026-06-30&camera=senat"`}</Code>
        <Code>{`# cum s-a votat o lege (toate voturile de plen pe codul ei), CSV
curl "${SITE}/api/v1/votes?code=L230/2025&format=csv" > voturi-L230.csv`}</Code>
        <Code>{`# vot nominal: cum a votat fiecare parlamentar pe o lege, CSV
curl "${SITE}/api/v1/votes?code=L230/2025&nominal=1&format=csv" > vot-nominal-L230.csv`}</Code>
        <Code>{`# drumul unei legi prin Parlament (Senat → Cameră → promulgare)
curl "${SITE}/api/v1/laws?code=L230/2025"`}</Code>
        <Code>{`# fișa de vot a unui parlamentar
curl "${SITE}/api/v1/parlamentari?camera=camera&nume=Ponta"`}</Code>
        <p className="text-sm text-muted leading-relaxed">
          Lista completă a endpoint-urilor și parametrilor e la{' '}
          <a href={`${SITE}/api/v1`} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            /api/v1
          </a>
          . Accesul e read-only.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Descărcare completă</h2>
        <p className="text-sm text-foreground leading-relaxed">
          Pentru analize pe tot setul, ia fișierul întreg — regenerat zilnic și servit din cache, deci
          nu apeși direct pe baza de date. Patru seturi:{' '}
          <code className="text-[12.5px] bg-raised px-1 rounded">voturi</code>,{' '}
          <code className="text-[12.5px] bg-raised px-1 rounded">legi</code>,{' '}
          <code className="text-[12.5px] bg-raised px-1 rounded">deputati</code>,{' '}
          <code className="text-[12.5px] bg-raised px-1 rounded">senatori</code>.
        </p>
        <Code>{`# toate voturile, CSV
curl "${SITE}/api/v1/export/voturi?format=csv" > voturi.csv

# toate legile cu statusul lor, JSON
curl "${SITE}/api/v1/export/legi"`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Pentru jurnaliști</h2>
        <p className="text-sm text-foreground leading-relaxed">
          Dacă lucrezi la un material și ai nevoie de un export anume, o verificare de metodologie
          sau context despre limitările datelor (adoptări tacite, absențe structurale ale
          miniștrilor), scrie-ne:{' '}
          <a href="mailto:siminiucdenis@gmail.com" className="underline hover:text-muted">siminiucdenis@gmail.com</a>.
        </p>
      </section>
    </div>
  )
}
