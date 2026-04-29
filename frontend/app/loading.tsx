import { StatsCardSkeleton, TableSkeleton } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <TableSkeleton rows={10} />
    </div>
  )
}
