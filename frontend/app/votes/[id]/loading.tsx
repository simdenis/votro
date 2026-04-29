import { Skeleton, TableSkeleton } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="flex gap-8">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-28" />)}
      </div>
      <Skeleton className="h-48 w-full" />
      <TableSkeleton rows={20} />
    </div>
  )
}
