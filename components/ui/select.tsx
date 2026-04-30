import * as React from 'react'
import { cn } from '@/lib/utils/cn'

// Select per inputs.md — same shape language as Input.
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-pill border border-border-default-medium bg-neutral-secondary-medium px-3 py-2 text-sm text-heading shadow-xs transition-all duration-200',
        'hover:border-border-default-strong',
        'focus-visible:outline-none focus-visible:border-border-brand focus-visible:ring-1 focus-visible:ring-brand',
        'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-disabled',
        className
      )}
      {...props}
    />
  )
)
Select.displayName = 'Select'
