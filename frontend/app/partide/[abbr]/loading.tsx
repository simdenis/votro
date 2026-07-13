import { Skeleton, StatsCardSkeleton, TableSkeleton } from '@/components/skeleton'
export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <StatsCardSkeleton key={i} />)}</div>
      <TableSkeleton rows={10} />
    </div>
  )
}
