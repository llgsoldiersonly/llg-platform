import * as React from 'react'
import { cn } from '@/lib/utils/cn'

// Input per inputs.md.
//   Display:      block, full width
//   Radius:       9999px (pill)
//   Border:       1px border-default-medium
//   Background:   neutral-secondary-medium
//   Shadow:       shadow-xs
//   Padding:      12px horizontal, 10px vertical
//   Font:         14px, heading text color
//   Placeholder:  body text color
//   Focus:        no outline, brand border + 1px brand ring
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex w-full rounded-pill border border-border-default-medium bg-neutral-secondary-medium px-3 py-2.5 text-sm text-heading shadow-xs transition-all duration-200',
        'placeholder:text-body',
        'hover:border-border-default-strong',
        'focus-visible:outline-none focus-visible:border-border-brand focus-visible:ring-1 focus-visible:ring-brand',
        'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-disabled',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
