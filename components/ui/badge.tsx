import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

// Badge per badges.md. Pill-shaped (9999px radius), 1px border, 12px font /
// 6px×2px padding by default. 7 variants from the spec — legacy aliases
// (default, secondary, info) preserved for existing call sites.
const badgeVariants = cva(
  'inline-flex items-center rounded-pill border px-1.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        brand:       'bg-brand-softer       border-border-brand-subtle   text-fg-brand-strong',
        alternative: 'bg-neutral-primary-soft border-border-default      text-heading',
        gray:        'bg-neutral-secondary-medium border-border-default  text-heading',
        danger:      'bg-danger-soft        border-border-danger-subtle  text-fg-danger-strong',
        success:     'bg-success-soft       border-border-success-subtle text-fg-success-strong',
        warning:     'bg-warning-soft       border-border-warning-subtle text-fg-warning',
        dark:        'bg-dark               border-transparent           text-white',
        // Legacy aliases used across the existing codebase
        default:     'bg-dark               border-transparent           text-white',
        secondary:   'bg-neutral-secondary-medium border-border-default  text-heading',
        destructive: 'bg-danger-soft        border-border-danger-subtle  text-fg-danger-strong',
        info:        'bg-brand-softer       border-border-brand-subtle   text-fg-brand-strong',
        outline:     'bg-transparent        border-border-default        text-body',
      },
      size: {
        default: 'px-1.5 py-0.5 text-xs',
        lg:      'px-2   py-1   text-sm',
      },
    },
    defaultVariants: { variant: 'gray', size: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}
