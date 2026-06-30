/**
 * Compact search box shown top-right on every page. Plain GET form → /search?q=,
 * so it works without client JS.
 */
export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" method="get" className="relative w-full max-w-[260px]" role="search">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Caută legi, parlamentari…"
        aria-label="Caută"
        className="w-full rounded-full border border-rim bg-surface pl-9 pr-3 py-2 text-[14px] text-foreground placeholder:text-faint focus:outline-none focus:border-[#0f2464] transition-colors"
      />
    </form>
  )
}
