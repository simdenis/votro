/** Inline glossary tooltip: a defined term (or a small ⓘ marker) that reveals a
 *  short explanation on hover/focus. Pure CSS, server-safe — same pattern as
 *  HoverNames. Use it to explain metrics (coeziune, deviere, poziție partid…)
 *  right where they appear, instead of sending the reader to /despre. */
export function InfoHint({
  tip,
  title,
  children,
}: {
  tip: string
  /** Optional bold label above the explanation. */
  title?: string
  /** The visible trigger. Omit to render a small ⓘ marker. */
  children?: React.ReactNode
}) {
  return (
    <span className="relative group/ih inline-flex items-center align-middle cursor-help focus-within:z-30" tabIndex={0}>
      {children ?? (
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full border border-rim text-[10px] font-semibold text-faint leading-none ml-1 select-none"
        >
          i
        </span>
      )}
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover/ih:visible group-hover/ih:opacity-100 group-focus-within/ih:visible group-focus-within/ih:opacity-100 transition-opacity duration-150 absolute z-30 left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[260px] rounded-lg border border-rim bg-surface shadow-lg px-3 py-2 text-left normal-case"
      >
        {title && (
          <span className="block text-[10px] uppercase tracking-widest text-faint mb-1 whitespace-nowrap">{title}</span>
        )}
        <span className="block text-xs text-muted leading-snug font-normal">{tip}</span>
      </span>
    </span>
  )
}

/** Canonical metric wording — shared so /partide and /partide/[abbr] never drift.
 *  Mirrors the fuller explanations on /despre. */
export const METRIC_TIPS = {
  coeziune:
    'Cât de des au votat la fel membrii partidului, pe voturile disputate (unde tabăra minoritară a strâns cel puțin 20% din voturi). Voturile aproape unanime sunt excluse.',
  devieri:
    'Câte voturi împotriva liniei de partid, la fiecare 100 de voturi exprimate de membri. E o rată, ca partidele mari să nu pară automat mai indisciplinate.',
  absenta:
    'Media absențelor membrilor activi la voturile de plen — ca procent din toate voturile ținute în camera lor. Membrii Guvernului nu sunt incluși.',
  pozitie:
    'Cum a votat majoritatea membrilor partidului la fiecare vot: pentru, împotrivă sau abținere.',
} as const

/** A defined term styled as a colored, semibold trigger for InfoHint. */
export function Term({ children, color = 'var(--sidebar-bg)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="font-semibold underline decoration-dotted decoration-rim underline-offset-2" style={{ color }}>
      {children}
    </span>
  )
}
