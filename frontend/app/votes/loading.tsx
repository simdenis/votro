import { TableSkeleton } from '@/components/skeleton'
import { Skeleton } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-9 w-96" />
      <TableSkeleton rows={12} />
    </div>
  )
}
