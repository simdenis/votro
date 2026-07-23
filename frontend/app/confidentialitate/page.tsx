import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Confidențialitate — LaButoane',
  description: 'Ce date colectăm (doar emailul, dacă te abonezi), cum le folosim și cum te dezabonezi.',
}

const CONTACT = 'siminiucdenis@gmail.com'

export default function ConfidentialitatePage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Confidențialitate</h1>
        <p className="text-sm text-muted mt-3">Pe scurt: colectăm cât mai puțin. Nu vindem nimic. Te poți dezabona oricând, dintr-un click.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Ce date colectăm</h2>
        <p className="text-foreground leading-relaxed">
          Ca să vizitezi site-ul <strong>nu îți cerem nimic</strong> — fără cont, fără date personale.
          Singurul moment în care ne dai o informație e când te abonezi voluntar:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-foreground leading-relaxed">
          <li><strong>Newsletter</strong> — adresa ta de email, ca să-ți trimitem rezumatul săptămânal.</li>
          <li><strong>Alerte</strong> — adresa ta de email și legea/parlamentarul pe care alegi să-l urmărești, ca să te anunțăm la un vot nou sau o promulgare.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Cum folosim emailul</h2>
        <p className="text-foreground leading-relaxed">
          Doar ca să-ți trimitem exact ce ai cerut (newsletterul sau alertele). Nu-l folosim în alt scop,
          nu-l vindem și nu-l dăm nimănui pentru marketing. Abonarea la alerte cere o confirmare pe email
          (dublu opt-in), ca nimeni să nu te poată abona fără voia ta.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Cu cine lucrăm (procesatori)</h2>
        <p className="text-foreground leading-relaxed">
          Emailurile pleacă prin <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">Resend</a>;
          datele stau la <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">Supabase</a>;
          site-ul rulează pe <a href="https://cloudflare.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">Cloudflare</a>.
          Toți sunt furnizori uzuali de infrastructură și îți procesează datele doar ca să funcționeze serviciul.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Drepturile tale</h2>
        <p className="text-foreground leading-relaxed">
          Te poți <strong>dezabona instant</strong> din linkul aflat în fiecare email. Vrei să-ți ștergem
          complet adresa sau vrei să știi ce date avem despre tine? Scrie-ne la{' '}
          <a href={`mailto:${CONTACT}`} className="underline hover:text-muted">{CONTACT}</a> și rezolvăm.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Datele parlamentarilor</h2>
        <p className="text-foreground leading-relaxed">
          Voturile, absențele și afilierile afișate provin din surse publice oficiale
          (<a href="https://senat.ro" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">senat.ro</a>,{' '}
          <a href="https://cdep.ro" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted">cdep.ro</a>) și
          privesc activitatea publică a aleșilor. Dacă vezi o eroare, folosește butonul{' '}
          <strong>„Raportează o greșeală"</strong> de pe pagina respectivă.
        </p>
      </section>

      <p className="text-[12px] text-faint pt-2">LaButoane e un proiect independent, neafiliat politic. Contact: <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.</p>
    </div>
  )
}
