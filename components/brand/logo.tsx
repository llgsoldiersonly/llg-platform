import { cn } from '@/lib/utils/cn'

// LLG mark — Saturn-style planet with rocket. Two variants:
//   - default: full color from public/llg-logo-mark.svg (gradients)
//   - white:   currentColor white-only from public/llg-logo-white.svg
// Use white on dark surfaces (footer, hero on dark backgrounds, etc.).
export function LlgMark({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'white'
}) {
  const src = variant === 'white' ? '/llg-logo-white.svg' : '/llg-logo-mark.svg'
  return (
    <img
      src={src}
      alt="Legal Leads Group"
      className={cn('h-10 w-10', className)}
    />
  )
}

// Mark + wordmark + tagline lockup. Use this in the topbar / login screen.
// `size` controls the relative scale; default is the standard topbar size.
// Text is rendered as HTML so it picks up the app's font stack (DM Serif
// Display) rather than the SVG's baked-in Cinzel fallback.
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
    sm: { mark: 'h-8 w-8',   heading: 'text-base', tag: 'text-[9px]' },
    md: { mark: 'h-11 w-11', heading: 'text-xl',   tag: 'text-[10px]' },
    lg: { mark: 'h-14 w-14', heading: 'text-2xl',  tag: 'text-xs' },
  }[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LlgMark className={dims.mark} />
      <div className="leading-tight">
        <h1 className={cn('font-serif text-slate-900', dims.heading)}>
          Legal Leads Group
        </h1>
        {showTagline && (
          <p className={cn('uppercase tracking-[0.18em] text-slate-600 mt-0.5', dims.tag)}>
            Rocket Fuel For Your Firm
          </p>
        )}
      </div>
    </div>
  )
}

// Full SVG wordmark + tagline as a single asset. Useful as a hero on a
// dark background (e.g. login screen split-panel) where you want the
// "Cinzel" baked-in serif typography for an editorial feel. Wrap with a
// parent that sets `color: white` (or use the className) to tint.
export function LlgFullLogo({ className }: { className?: string }) {
  return (
    <img
      src="/llg-logo-white.svg"
      alt="Legal Leads Group — Rocket Fuel For Your Firm"
      className={cn('h-32', className)}
    />
  )
}
