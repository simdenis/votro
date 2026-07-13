import { TableSkeleton } from '@/components/skeleton'
import { Skeleton } from '@/components/skeleton'
export default function Loading() {
  return <div className="space-y-6"><Skeleton className="h-7 w-40" /><TableSkeleton rows={15} /></div>
}
