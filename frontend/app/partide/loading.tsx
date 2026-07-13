import { Skeleton } from '@/components/skeleton'
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-28" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  )
}
