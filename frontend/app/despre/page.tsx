import type { Metadata } from 'next'
import { SectionNav, DESPRE_SECTIONS } from '@/components/section-nav'

export const metadata: Metadata = {
  title: 'Despre LaButoane',
  description: 'Cum funcționează LaButoane, cum sunt colectate datele și ce înseamnă devierea de la linia de partid.',
}

export default function DesprePage() {
  return (
    <div className="max-w-2xl space-y-10">
      <SectionNav items={DESPRE_SECTIONS} />
      <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Despre LaButoane</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Ce este LaButoane</h2>
        <p className="text-foreground leading-relaxed">
          LaButoane urmărește voturile plenare ale Senatului și Camerei Deputaților din România și le face
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
          exprimate (pentru / împotrivă / abținere) contează. Parlamentarii neafiliați și grupul
          minorităților naționale nu au o linie de partid, deci nu calculăm devieri sau coeziune pentru ei.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          <strong className="text-foreground">Loialitatea</strong> și <strong className="text-foreground">prezența</strong> sunt
          două lucruri diferite și le arătăm separat, cu numitori expliciți — a le contopi
          într-o singură cifră face ca un absent să pară un rebel. <strong className="text-foreground">Loialitate</strong> =
          voturile aliniate cu partidul / voturile <em>exprimate</em> (ex. 397/415 = 96%).{' '}
          <strong className="text-foreground">Prezență</strong> = voturile exprimate / toate voturile de plen
          ținute în camera sa (ex. 415/958 = 43%). Un parlamentar poate fi 96% loial și, în același timp,
          prezent la doar 43% din voturi.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Coeziunea unui partid se calculează <strong className="text-foreground">doar pe voturile
          disputate</strong> — cele în care tabăra minoritară (pentru vs. împotrivă + abțineri) a strâns
          cel puțin 20% din voturile exprimate. Majoritatea voturilor din plen sunt procedurale sau
          aproape unanime; incluse în calcul, ar împinge toate partidele la 90%+ și cifra n-ar mai
          spune nimic. Pe voturile disputate se vede diferența reală dintre partide.
        </p>
      </section>

      <section id="metodologie-absente" className="space-y-3 scroll-mt-20">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Cum calculăm prezența și absența</h2>
        <p className="text-foreground leading-relaxed">
          Prezența unui parlamentar = voturile la care apare în listele oficiale, împărțite la
          toate voturile ținute în camera sa de la validarea mandatului. Absența este restul
          (100% − prezența). Cine e consemnat prezent dar nu apasă butonul („prezent, fără vot")
          contează ca prezent — îl afișăm separat pe fișă, nu ca absență. Absența medie a unui
          partid este media absențelor membrilor săi activi.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Parlamentarii care fac sau au făcut parte din Guvern în această legislatură (premier,
          vicepremieri, miniștri) nu votează în plen cât sunt în funcție — sunt marcați cu o
          etichetă distinctă, nu apar în topul absențelor și nu intră în media de absență a
          partidului, pentru că absența lor e structurală, nu o alegere. Eticheta rămâne și după
          plecarea din Guvern: absențele acumulate în mandatul de ministru nu devin retroactiv
          „chiul".
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Sursele oficiale nu spun <em>de ce</em> lipsește cineva: o delegație parlamentară în
          străinătate sau un concediu medical arată în date la fel ca o absență nemotivată. Afișăm
          cifrele brute — interpretarea rămâne a cititorului. Când avem o justificare documentată
          (concediu medical, delegație oficială), o adăugăm ca <strong className="text-foreground">notă
          de context</strong> pe fișa parlamentarului, iar în topul absențelor numele apare marcat cu
          „ⓘ". Orice parlamentar sau cetățean poate <strong className="text-foreground">contesta</strong> o
          cifră prin butonul de pe fiecare fișă; verificăm și, dacă e cazul, adăugăm nota.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Drumul unei legi și adoptarea tacită</h2>
        <p className="text-foreground leading-relaxed">
          O lege trece prin ambele camere: prima cameră sesizată, apoi camera decizională, apoi
          merge la Președinte pentru promulgare (care o poate retrimite Parlamentului sau sesiza
          Curtea Constituțională). Constituția (art. 75) dă primei camere 45 de zile să se
          pronunțe — 60 pentru coduri și legi complexe. Dacă termenul expiră fără vot, proiectul
          e <strong>considerat adoptat fără ca cineva să fi votat</strong> („adoptare tacită") și
          merge mai departe. Pagina „Termene tacite" arată proiectele cu termenul în curs, cu
          datele oficiale publicate de Camera Deputaților.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          De aceea unele legi promulgate apar la noi fără votul uneia dintre camere: au fost
          adoptate tacit (nu există un vot de consemnat) sau votul a avut loc înainte de
          20 decembrie 2024, începutul actualei legislaturi — data de la care baza noastră de date acoperă voturile plenului.
          Le marcăm cu „Adoptată*".
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Rezumatele „Pe scurt"</h2>
        <p className="text-foreground leading-relaxed">
          Pentru multe legi afișăm un rezumat în limbaj simplu, generat automat (AI) din expunerea
          de motive oficială — documentul în care inițiatorii explică ce vrea legea. Important:
          expunerea de motive e <strong>argumentația inițiatorilor</strong>, nu o analiză neutră —
          rezumatul îi preia inevitabil perspectiva. Citiți-l ca „ce spun inițiatorii că face legea";
          linkul către PDF-ul oficial e mereu alături. Tot automat atribuim și categoria legii
          (Sănătate, Justiție, Economie…).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Scorul de „Interes"</h2>
        <p className="text-foreground leading-relaxed">
          Pe pagina principală poți sorta voturile după <strong className="text-foreground">Interes</strong> —
          un scor de la 1 la 100 <strong>generat automat (AI, model Gemini)</strong> din titlul și
          rezumatul legii. Estimează cât de mult ar interesa legea un cetățean obișnuit (nu un jurist
          sau funcționar).
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Factorii luați în calcul: impactul direct asupra vieții de zi cu zi (bani, taxe, pensii,
          salarii, sănătate, școală, prețuri, amenzi, drepturi) și cât de discutat e subiectul în
          spațiul public. Legile tehnice sau de rutină (ratificări, reorganizări administrative)
          primesc scoruri mici. E un ajutor editorial, nu un verdict asupra importanței juridice a legii.
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
          LaButoane nu este afiliat niciunui partid politic, organizație sau publicație.
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
