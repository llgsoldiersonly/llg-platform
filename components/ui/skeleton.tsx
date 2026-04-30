import { cn } from '@/lib/utils/cn'

// Minimal animated placeholder block. Compose a few of these to match the
// shape of a loading screen — see app/admin/loading.tsx for an example.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-neutral-quaternary', className)}
      {...props}
    />
  )
}
