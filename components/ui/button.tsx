import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

// Button per design-system buttons.md. Pill-shaped (radius 9999px), Roboto
// medium weight, glint effect on every variant except ghost + disabled.
//
// Glint shorthand: combined box-shadow that layers shadow-xs + an inset
// top-edge highlight (--color-1-400) + a subtle outer color glow
// (--color-1-700). Implemented as a CSS class so variants don't have to
// re-declare it.
const GLINT =
  'shadow-[var(--shadow-xs),inset_var(--color-1-400)_0_6px_0px_-5px,var(--color-1-700)_0_4px_10px_-5px]'

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border font-medium',
    'transition-colors duration-200 disabled:pointer-events-none disabled:opacity-100',
    'focus-visible:outline-none active:scale-[0.98]'
  ),
  {
    variants: {
      variant: {
        brand: cn(
          'bg-brand text-white border-transparent',
          'hover:bg-brand-strong',
          'focus-visible:ring-4 focus-visible:ring-brand-medium',
          GLINT
        ),
        secondary: cn(
          'bg-neutral-secondary-medium text-body border-border-default-medium',
          'hover:bg-neutral-tertiary-medium hover:text-heading',
          'focus-visible:ring-4 focus-visible:ring-neutral-tertiary',
          GLINT
        ),
        tertiary: cn(
          'bg-neutral-primary-soft text-body border-border-default',
          'hover:bg-neutral-secondary-medium hover:text-heading',
          'focus-visible:ring-4 focus-visible:ring-neutral-tertiary-soft',
          GLINT
        ),
        success: cn(
          'bg-success text-white border-transparent',
          'hover:bg-success-strong',
          'focus-visible:ring-4 focus-visible:ring-success-medium',
          GLINT
        ),
        danger: cn(
          'bg-danger text-white border-transparent',
          'hover:bg-danger-strong',
          'focus-visible:ring-4 focus-visible:ring-danger-medium',
          GLINT
        ),
        warning: cn(
          'bg-warning text-white border-transparent',
          'hover:bg-warning-strong',
          'focus-visible:ring-4 focus-visible:ring-warning-medium',
          GLINT
        ),
        dark: cn(
          'bg-dark text-white border-transparent',
          'hover:bg-dark-strong',
          'focus-visible:ring-4 focus-visible:ring-neutral-tertiary',
          GLINT
        ),
        ghost: cn(
          'bg-transparent text-heading border-transparent shadow-none',
          'hover:bg-neutral-secondary-medium',
          'focus-visible:ring-4 focus-visible:ring-neutral-tertiary'
        ),
        // Aliases preserved for existing call sites: default→brand, outline→tertiary,
        // destructive→danger. Behaviorally identical to the spec variants.
        default:     '',
        outline:     '',
        destructive: '',
      },
      size: {
        xs: 'h-7  px-3 text-xs',
        sm: 'h-8  px-3 text-sm',
        default: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        xl: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    compoundVariants: [
      // Apply spec styles to legacy aliases
      { variant: 'default',     class: cn(
        'bg-brand text-white border-transparent hover:bg-brand-strong focus-visible:ring-4 focus-visible:ring-brand-medium',
        GLINT,
      ) },
      { variant: 'outline',     class: cn(
        'bg-neutral-primary-soft text-body border-border-default hover:bg-neutral-secondary-medium hover:text-heading focus-visible:ring-4 focus-visible:ring-neutral-tertiary-soft',
        GLINT,
      ) },
      { variant: 'destructive', class: cn(
        'bg-danger text-white border-transparent hover:bg-danger-strong focus-visible:ring-4 focus-visible:ring-danger-medium',
        GLINT,
      ) },
    ],
    defaultVariants: { variant: 'brand', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { buttonVariants }
