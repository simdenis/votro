import Link from 'next/link'
import type { Metadata } from 'next'
import { SectionNav, DESPRE_SECTIONS } from '@/components/section-nav'
import { OpenOnHash } from '@/components/open-on-hash'
import { PRESS_MENTIONS } from '@/lib/press'

export const metadata: Metadata = {
  title: 'Despre LaButoane',
  description: 'Cum funcționează LaButoane, cum sunt colectate datele și ce înseamnă devierea de la linia de partid.',
}

const SEC = 'font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px]'

// Methodology folds away so the page reads short; #metodologie-* deep links
// (homepage absence list, /initiative) open their block via OpenOnHash.
function Method({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group py-3 scroll-mt-20">
      <summary className="cursor-pointer list-none flex items-baseline justify-between gap-4 text-[15px] text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <span className="font-mono text-[13px] text-muted group-open:hidden">+</span>
        <span className="font-mono text-[13px] text-muted hidden group-open:inline">−</span>
      </summary>
      <div className="mt-2 space-y-2 text-[14px] text-muted leading-relaxed">{children}</div>
    </details>
  )
}

const ext = 'underline underline-offset-2 hover:text-foreground'

export default function DesprePage() {
  return (
    <div className="max-w-2xl space-y-10">
      <OpenOnHash />
      <SectionNav items={DESPRE_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Despre LaButoane</h1>
        <div className="mt-4 space-y-3 text-foreground leading-relaxed">
          <p>
            LaButoane arată cum votează fiecare senator și deputat. Datele vin zilnic, nemodificate, de pe{' '}
            <a href="https://senat.ro" target="_blank" rel="noopener noreferrer" className={ext}>senat.ro</a> și{' '}
            <a href="https://cdep.ro" target="_blank" rel="noopener noreferrer" className={ext}>cdep.ro</a>.
          </p>
          <p className="text-[14px] text-muted">
            Nu suntem afiliați niciunui partid, organizații sau publicații. Întrebări și sesizări:{' '}
            <a href="mailto:siminiucdenis@gmail.com" className={ext}>siminiucdenis@gmail.com</a>
          </p>
        </div>
      </div>

      <section>
        <h2 className={SEC}>Metodologie</h2>
        <div className="divide-y divide-rim border-b border-rim">
          <Method id="metodologie-absente" title="Prezență și absență">
            <p>
              Prezența = voturile la care apare în listele oficiale, împărțite la toate voturile din camera sa de la
              validarea mandatului. «Prezent, fără vot» contează ca prezent. Absența medie a unui partid e media
              membrilor activi.
            </p>
            <p>
              Membrii Guvernului din această legislatură nu votează cât sunt în funcție, așa că nu intră în topul
              absențelor și nici în media partidului, nici după ce pleacă din Guvern.
            </p>
            <p>
              Sursele oficiale nu spun de ce lipsește cineva. Când avem o justificare documentată (concediu medical,
              delegație), o punem ca notă pe fișă, iar în top numele apare cu «ⓘ». Orice cifră poate fi contestată
              din butonul de pe fișă.
            </p>
          </Method>

          <Method title="Devieri, loialitate, coeziune">
            <p>
              Pentru fiecare vot luăm poziția cea mai frecventă din partid. Cine a votat altfel are o deviere. Absenții
              nu contează, nici neafiliații și minoritățile, care nu au linie de partid.
            </p>
            <p>
              Loialitatea și prezența sunt separate, cu numitori expliciți: cineva poate fi loial la 96% (397/415) și
              prezent la 43% (415/958). Într-o singură cifră, un absent ar părea rebel.
            </p>
            <p>
              Coeziunea se calculează doar pe voturile disputate, unde tabăra minoritară are cel puțin 20%. Pe voturile
              aproape unanime toate partidele ar avea peste 90%.
            </p>
          </Method>

          <Method id="metodologie-initiative" title="Inițiative">
            <p>
              Toate inițiativele din registrul PL-x (cdep.ro) și registrul L (senat.ro), legate prin trimiterea din
              fișa cdep. «Zile de la depunere» curge de la înregistrare; «zile fără raport», de când proiectul e la
              comisia de fond.
            </p>
            <p>
              «Fără vot în plen» înseamnă în lucru la prima cameră, înainte de orice vot. Nu include proiectele adoptate
              tacit. Timpul în comisie depinde de avize și sesiuni, deci nu explică singur de ce așteaptă un proiect.
            </p>
            <p>
              La «ordonanță în vigoare», regulile se aplică deja de la publicarea în Monitorul Oficial. Votul doar le
              confirmă sau le respinge.
            </p>
          </Method>

          <Method title="Legi fără votul unei camere">
            <p>
              Apar cu «Adoptată*»: au fost adoptate tacit sau votate înainte de 20 decembrie 2024, de când avem date.
              Drumul complet al unei legi e pe{' '}
              <Link href="/cum-functioneaza" className={ext}>Cum funcționează</Link>.
            </p>
          </Method>

          <Method title="Rezumate și titluri scurte">
            <p>
              Sunt generate automat (AI) din expunerea de motive, adică argumentația inițiatorilor, nu o analiză
              neutră. Linkul spre documentul oficial e mereu alături. Tot automat atribuim și categoria.
            </p>
          </Method>

          <Method title="Limite">
            <p>
              Doar voturile nominale din plen, fără comisii și voturi secrete. Actualizare zilnică, cu până la 24 de ore
              întârziere. Calitatea depinde de senat.ro și cdep.ro.
            </p>
          </Method>
        </div>
      </section>

      {PRESS_MENTIONS.length > 0 && (
        <section id="in-presa" className="scroll-mt-20">
          <h2 className={SEC}>În presă</h2>
          <ul className="divide-y divide-rim">
            {PRESS_MENTIONS.map((m) => (
              <li key={m.url} className="py-3 text-[14px] leading-relaxed">
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                  {m.title}
                </a>
                <div className="text-[13px] text-muted">
                  {`${m.outlet} · ${new Date(m.date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
