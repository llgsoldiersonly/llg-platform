import { cn } from '@/lib/utils/cn'

// LLG mark — sourced from public/llg-logo.svg (the canonical brand asset).
// Plain <img> rather than next/image because SVGs don't benefit from the
// optimization pipeline and the markup is simpler.
export function LlgMark({ className }: { className?: string }) {
  return (
    <img
      src="/llg-logo.svg"
      alt="Legal Leads Group"
      className={cn('h-10 w-10 rounded-md', className)}
    />
  )
}

// Mark + wordmark + tagline lockup. Use this in the topbar / login screen.
// `size` controls the relative scale; default is the standard topbar size.
export function LlgWordmark({
  size = 'md',
  showTagline = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}) {
  const dims = {
    sm: { mark: 'h-8 w-8', heading: 'text-base', tag: 'text-[9px]' },
    md: { mark: 'h-11 w-11', heading: 'text-xl', tag: 'text-[10px]' },
    lg: { mark: 'h-14 w-14', heading: 'text-2xl', tag: 'text-xs' },
  }[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LlgMark className={dims.mark} />
      <div className="leading-tight">
        <h1 className={cn('font-serif text-slate-900', dims.heading)}>
          Legal Leads Group
        </h1>
        {showTagline && (
          <p className={cn('uppercase tracking-[0.18em] text-slate-500 mt-0.5', dims.tag)}>
            Success doesn&apos;t find you, we do
          </p>
        )}
      </div>
    </div>
  )
}
