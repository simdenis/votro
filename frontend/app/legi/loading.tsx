import { Skeleton } from '@/components/skeleton'

// Route-specific loading UI: mirrors the /legi layout (sub-nav, title, tabs,
// filter chips, table) so the transition doesn't flash the generic root
// stat-card skeleton, which doesn't match this page.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex gap-1.5">
        {[64, 72, 88].map((w, i) => <Skeleton key={i} className="h-7" style={{ width: w }} />)}
      </div>
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* tabs */}
      <div className="flex gap-3 border-b border-rim pb-2">
        {[56, 52, 60, 76, 78, 68].map((w, i) => <Skeleton key={i} className="h-5" style={{ width: w }} />)}
      </div>
      {/* filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[48, 70, 64, 58, 80, 66, 72, 54].map((w, i) => <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />)}
      </div>
      {/* table rows */}
      <div className="space-y-px">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3.5 border-b border-rim items-start">
            <Skeleton className="h-4 w-20" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-4 w-16 hidden md:block" />
            <Skeleton className="h-4 w-16 hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
