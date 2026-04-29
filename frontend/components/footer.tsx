import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-rim mt-16">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
        <span>
          VotRO · Date preluate din surse publice:{' '}
          <a href="https://senat.ro" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">senat.ro</a>
          {' · '}
          <a href="https://cdep.ro" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">cdep.ro</a>
        </span>
        <span className="flex items-center gap-3">
          <span>Actualizat zilnic</span>
          <span className="text-faint">·</span>
          <Link href="/despre" className="hover:text-foreground">Despre</Link>
          <span className="text-faint">·</span>
          <span>Nu suntem afiliați niciunui partid politic</span>
        </span>
      </div>
    </footer>
  )
}
