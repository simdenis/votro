import { Skeleton, StatsCardSkeleton, TableSkeleton } from '@/components/skeleton'
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-5 w-24" /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <StatsCardSkeleton key={i} />)}</div>
      <TableSkeleton rows={15} />
    </div>
  )
}
