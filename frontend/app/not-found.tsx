import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="py-16 text-center space-y-4">
      <p className="font-serif text-[64px] leading-none text-foreground">404</p>
      <h1 className="font-serif text-[26px] font-normal text-foreground">Pagina nu există</h1>
      <p className="text-sm text-muted max-w-md mx-auto">
        Linkul e greșit sau conținutul a fost mutat. Datele despre voturi și
        parlamentari le găsești din paginile de mai jos.
      </p>
      <div className="flex items-center justify-center gap-4 text-sm pt-2">
        <Link href="/" className="underline underline-offset-2 hover:text-foreground">Prima pagină</Link>
        <Link href="/voturi" className="underline underline-offset-2 hover:text-foreground">Voturi</Link>
        <Link href="/cautare" className="underline underline-offset-2 hover:text-foreground">Căutare</Link>
      </div>
    </div>
  )
}
