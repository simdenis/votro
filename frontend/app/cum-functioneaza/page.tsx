import Link from 'next/link'
import type { Metadata } from 'next'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'

export const metadata: Metadata = {
  title: 'Cum funcționează Parlamentul',
  description:
    'Drumul unei legi în România: cine o propune, prima cameră și camera decizională, adoptarea tacită, promulgarea, Curtea Constituțională și Monitorul Oficial.',
}

// Static explainer. Every rule cites the article of the Constitution
// (revised 2003) so a reader can check it; wording follows the site's style
// rules (no em dashes, plain sentences).

const STEPS = [
  { n: '1', title: 'Cineva propune legea', body: 'Guvernul, un deputat, un senator sau 100.000 de cetățeni.' },
  { n: '2', title: 'Prima cameră', body: 'Senatul sau Camera Deputaților, după domeniu. Are 45 de zile.' },
  { n: '3', title: 'Camera decizională', body: 'Cealaltă cameră. Votul ei e cel final.' },
  { n: '4', title: 'Președintele', body: 'Promulgă legea în 20 de zile sau o retrimite o dată.' },
  { n: '5', title: 'Monitorul Oficial', body: 'Legea intră în vigoare la 3 zile după publicare.' },
]

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-sm font-semibold text-muted scroll-mt-20">{children}</h2>
}
function Art({ n }: { n: string }) {
  return <span className="text-muted whitespace-nowrap">{`(art. ${n})`}</span>
}

export default function CumFunctioneazaPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <SectionNav items={LEGI_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Cum funcționează Parlamentul
        </h1>
        <p className="text-sm text-muted mt-3 leading-relaxed">
          Ce trebuie să știi ca să citești voturile de pe LaButoane. Fiecare regulă are trimitere la articolul
          din Constituția României (revizuită în 2003), ca să o poți verifica.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-5">
        {STEPS.map(s => (
          <li key={s.n} className="border-t border-rim py-3.5">
            <div className="font-mono text-[12px] text-muted">{s.n}</div>
            <div className="mt-1 text-[14px] font-semibold text-foreground leading-snug">{s.title}</div>
            <div className="mt-1 text-[13px] text-muted leading-snug">{s.body}</div>
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <H2 id="camere">Două camere</H2>
        <p className="text-foreground leading-relaxed">
          Parlamentul are două camere, Camera Deputaților și Senatul <Art n="61" />, alese o dată la patru ani{' '}
          <Art n="63" />. Lucrează în două sesiuni pe an: februarie–iunie și septembrie–decembrie <Art n="66" />.
          În vacanța parlamentară nu se votează, decât dacă e convocată o sesiune extraordinară.
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="initiativa">Cine poate propune o lege</H2>
        <p className="text-foreground leading-relaxed">
          Guvernul, deputații, senatorii și cel puțin 100.000 de cetățeni cu drept de vot, din cel puțin un sfert
          din județe, cu minimum 5.000 de semnături în fiecare dintre ele și în București <Art n="74" />. Ce vine
          de la Guvern se numește <em>proiect de lege</em>. Ce vine de la parlamentari sau cetățeni se numește{' '}
          <em>propunere legislativă</em>.
        </p>
        <p className="text-foreground leading-relaxed">
          Pe <Link href="/cine-propune" className="text-info hover:underline">Cine propune legile</Link> vezi câte
          proiecte a semnat fiecare partid și câte au devenit lege.
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="ordonante">Ordonanțele Guvernului</H2>
        <p className="text-foreground leading-relaxed">
          Guvernul poate face reguli și singur, prin ordonanțe <Art n="115" />. O ordonanță de urgență se aplică
          imediat ce e trimisă Parlamentului și publicată, dar Parlamentul trebuie apoi să o aprobe sau să o respingă
          printr-o lege. De aceea multe voturi din plen au titlul «pentru aprobarea Ordonanței…». Dacă votul respinge
          ordonanța, regulile ei încetează să se aplice. Dacă prima cameră nu se pronunță în 30 de zile, ordonanța
          de urgență e considerată adoptată de ea și merge la cealaltă cameră.
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="camere-rol">Prima cameră și camera decizională</H2>
        <p className="text-foreground leading-relaxed">
          Constituția împarte domeniile între camere: pentru unele legi Senatul votează primul, pentru altele Camera
          Deputaților <Art n="75" />. Prima cameră are 45 de zile să voteze (60 pentru coduri și legi foarte
          complexe). Apoi proiectul merge la cealaltă cameră, care decide definitiv.
        </p>
        <p className="text-foreground leading-relaxed">
          Asta înseamnă că o respingere la prima cameră nu oprește legea. Camera decizională o poate adopta oricum,
          și atunci legea a trecut de Parlament. Pe LaButoane, starea unei legi urmează ultimul vot: o lege respinsă
          de prima cameră și adoptată apoi de camera decizională apare adoptată.
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="tacit">Adoptarea tacită</H2>
        <p className="text-foreground leading-relaxed">
          Dacă prima cameră nu votează în termen, proiectul e considerat adoptat fără vot și merge mai departe{' '}
          <Art n="75" />. Nimeni nu apasă niciun buton, deci nu există un vot nominal. Pe{' '}
          <Link href="/tacite" className="text-info hover:underline">Termene tacite</Link> vezi proiectele al căror
          termen e pe cale să expire.
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="majoritati">Câte voturi trebuie</H2>
        <ul className="space-y-2 text-foreground leading-relaxed list-disc pl-5">
          <li>
            <strong>Legile ordinare</strong> trec cu majoritatea celor prezenți în sală <Art n="76" />.
          </li>
          <li>
            <strong>Legile organice</strong> (de exemplu cele despre alegeri, partide, organizarea Guvernului,
            statutul funcționarilor) au nevoie de majoritatea tuturor membrilor camerei, oricâți ar fi prezenți{' '}
            <Art n="73, 76" />.
          </li>
          <li>
            <strong>Revizuirea Constituției</strong> cere două treimi din membrii fiecărei camere și apoi un
            referendum <Art n="151" />.
          </li>
        </ul>
        <p className="text-sm text-muted leading-relaxed">
          De aceea, la o lege organică, absențele contează ca un vot împotrivă: legea trebuie să strângă un număr fix
          de voturi «pentru».
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="presedinte">Președintele și Curtea Constituțională</H2>
        <p className="text-foreground leading-relaxed">
          Legea adoptată de ambele camere ajunge la Președinte, care are 20 de zile să o promulge <Art n="77" />. O
          poate retrimite Parlamentului o singură dată, pentru reexaminare. Dacă Parlamentul o votează din nou,
          Președintele trebuie să o promulge în 10 zile.
        </p>
        <p className="text-foreground leading-relaxed">
          Înainte de promulgare, legea poate fi contestată la Curtea Constituțională de Președinte, de președinții
          camerelor, de Guvern, de Înalta Curte, de Avocatul Poporului, de cel puțin 50 de deputați sau de cel puțin
          25 de senatori <Art n="146" />. Dacă Curtea spune că legea încalcă Constituția, Parlamentul trebuie să o
          corecteze.
        </p>
        <p className="text-foreground leading-relaxed">
          După promulgare, legea se publică în Monitorul Oficial și intră în vigoare la 3 zile după publicare sau la
          data scrisă în ea <Art n="78" />.
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="guvern">Parlamentul și Guvernul</H2>
        <p className="text-foreground leading-relaxed">
          Guvernul are nevoie de votul de încredere al Parlamentului ca să se instaleze <Art n="103" />. Îl poate
          demite printr-o moțiune de cenzură, inițiată de cel puțin un sfert din deputați și senatori și adoptată cu
          majoritatea tuturor deputaților și senatorilor, în ședință comună <Art n="113" />.
        </p>
      </section>

      <section className="space-y-3">
        <H2 id="coduri">Codurile de pe LaButoane</H2>
        <ul className="space-y-2 text-foreground leading-relaxed list-disc pl-5">
          <li>
            <strong>L123/2026</strong> e numărul din registrul Senatului. Camera Deputaților numerotează aceleași
            proiecte separat, de forma <strong>PL-x 456/2026</strong>. Pe site folosim numărul Senatului când există.
          </li>
          <li>
            <strong>PHCD</strong> e o hotărâre a Camerei Deputaților, adică o decizie care privește doar Camera (de
            exemplu regulamentul ei). Nu trece prin Senat și nu ajunge la Președinte.
          </li>
          <li>
            <strong>Votul final</strong> e votul pe întregul proiect. Înainte de el, plenul poate vota și amendamente
            sau rapoarte de comisie. Pe LaButoane numărăm la prezență toate voturile, dar «cum a votat legea» arată
            votul final.
          </li>
        </ul>
        <p className="text-sm text-muted leading-relaxed">
          Cum calculăm prezența, devierile de la linia de partid și coeziunea e explicat pe{' '}
          <Link href="/despre" className="text-info hover:underline">Despre</Link>.
        </p>
      </section>
    </div>
  )
}
