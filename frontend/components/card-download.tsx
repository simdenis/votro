/**
 * "Download image" button — links to a 1080×1080 card PNG route with the
 * download attribute. Same-origin, so the browser saves the file.
 */
export function CardDownload({ href, filename, label = 'Descarcă imagine' }: { href: string; filename: string; label?: string }) {
  return (
    <a
      href={href}
      download={filename}
      className="inline-flex items-center gap-2 rounded-full border border-rim bg-surface px-4 py-2 text-[13px] font-medium text-foreground hover:bg-raised transition-colors"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </a>
  )
}
