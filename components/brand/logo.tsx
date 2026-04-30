import { cn } from '@/lib/utils/cn'

// LLG mark — purple rounded square with a white shield outline. Inline SVG
// so it scales freely and never 404s. Sized via a className override for
// responsive contexts.
export function LlgMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-10 w-10', className)}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="10" fill="var(--color-llg-purple-700)" />
      <path
        d="M24 11 L34 15 V24 C34 30 29 35 24 37 C19 35 14 30 14 24 V15 Z"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 24.5 L23 28 L29 21"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
